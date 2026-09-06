"use server";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/schemas";
import { audit } from "@/lib/services/audit.service";
import { getStaffSession } from "@/lib/auth/authorize";
import { allowRequest, clearRequestRateLimit } from "@/lib/security/rate-limit";

const DUMMY_PASSWORD_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.9D9ATmB2vM9QMfUHiu33FhZsHk1vYqG";

export type LoginState = { error?: string };
export async function loginAction(
  _state: LoginState,
  form: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success)
    return {
      error: "Enter a valid email and a password of at least 8 characters.",
    };
  const normalizedEmail = parsed.data.email.toLowerCase();
  const [ipAllowed, accountAllowed] = await Promise.all([
    allowRequest("staff-login-ip", 30, 15 * 60_000),
    allowRequest("staff-login-account", 8, 15 * 60_000, normalizedEmail),
  ]);
  if (!ipAllowed || !accountAllowed) {
    return { error: "Too many sign-in attempts. Try again in 15 minutes." };
  }
  let staff:
    | {
        id: string;
        name: string;
        email: string;
        role: string;
        passwordHash: string;
      }
    | undefined;
  if (db) {
    try {
      staff = (
        await db
          .select()
          .from(adminUsers)
          .where(
            and(
              eq(adminUsers.email, normalizedEmail),
              eq(adminUsers.isActive, true),
            ),
          )
          .limit(1)
      )[0];
    } catch (error) {
      console.error("[MH OP login database]", error);
      return {
        error:
          "Sign-in is temporarily unavailable. Check the database connection and try again.",
      };
    }
  } else if (
    process.env.NODE_ENV !== "production" &&
    parsed.data.email === "admin@example.invalid"
  ) {
    staff = {
      id: "local-admin",
      name: "Local Administrator",
      email: "admin@example.invalid",
      role: "admin",
      passwordHash: await bcrypt.hash("demo-only", 10),
    };
  }
  const passwordMatches = await bcrypt.compare(
    parsed.data.password,
    staff?.passwordHash || DUMMY_PASSWORD_HASH,
  );
  if (!staff || !passwordMatches) {
    await audit(
      "auth.login_failed",
      undefined,
      "Sign-in rejected: invalid credentials or inactive account",
      normalizedEmail,
    );
    return { error: "Email or password is incorrect." };
  }
  await audit(
    "auth.login_succeeded",
    staff.id,
    `Staff signed in with role ${staff.role}`,
    `${staff.name} (${staff.email})`.slice(0, 120),
  );
  await Promise.all([
    clearRequestRateLimit("staff-login-ip"),
    clearRequestRateLimit("staff-login-account", normalizedEmail),
  ]);
  const jar = await cookies();
  jar.set(
    SESSION_COOKIE,
    await createSessionToken({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    },
  );
  const requested = String(form.get("next") || "/dashboard");
  redirect(
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/dashboard",
  );
}

export async function logoutAction() {
  const staff = await getStaffSession();
  if (staff)
    await audit(
      "auth.logout",
      staff.id,
      "Staff signed out",
      `${staff.name} (${staff.email})`.slice(0, 120),
    );
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
