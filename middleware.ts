import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose/jwt/verify";
import { isPublicRoute } from "@/lib/auth/route-policy";

export async function middleware(request: NextRequest) {
  if (isPublicRoute(request.nextUrl.pathname)) return NextResponse.next();
  const token = request.cookies.get("gadgetos_session")?.value;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(
        token,
        new TextEncoder().encode(process.env.AUTH_SECRET),
        { issuer: "gadgetos", audience: "gadgetos-staff" },
      );
      return NextResponse.next();
    } catch {}
  }
  const login = new URL("/login", request.url);
  login.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(login);
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
