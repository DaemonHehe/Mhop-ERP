import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export const SESSION_COOKIE = "gadgetos_session";
export interface StaffSession {
  id: string;
  name: string;
  email: string;
  role: string;
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value && process.env.NODE_ENV === "production")
    throw new Error("AUTH_SECRET is required in production");
  return new TextEncoder().encode(
    value || "gadgetos-local-development-secret-change-me",
  );
}

export async function createSessionToken(staff: StaffSession) {
  return new SignJWT(staff as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .setIssuer("gadgetos")
    .setAudience("gadgetos-staff")
    .sign(secret());
}

export async function verifySessionToken(
  token: string,
): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "gadgetos",
      audience: "gadgetos-staff",
    });
    return {
      id: String(payload.id),
      name: String(payload.name),
      email: String(payload.email),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}
