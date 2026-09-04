import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type StaffSession,
} from "./session";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { cache } from "react";

export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
});

const getCurrentStaff = cache(async () => {
  const session = await getStaffSession();
  if (!session) return null;
  let current = session;
  if (db) {
    try {
      const [staff] = await db
        .select({
          id: adminUsers.id,
          name: adminUsers.name,
          email: adminUsers.email,
          role: adminUsers.role,
          isActive: adminUsers.isActive,
        })
        .from(adminUsers)
        .where(eq(adminUsers.id, session.id))
        .limit(1);
      if (!staff?.isActive) return null;
      current = {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
      };
    } catch (error) {
      console.error("[MH OP authorization]", error);
      return null;
    }
  }
  return current;
});

export async function authorizeStaff(roles?: string[]) {
  const current = await getCurrentStaff();
  return current && (!roles || roles.includes(current.role)) ? current : null;
}

export async function requireStaff(roles?: string[]) {
  const staff = await authorizeStaff(roles);
  if (!staff) throw new Error("Unauthorized");
  return staff;
}
