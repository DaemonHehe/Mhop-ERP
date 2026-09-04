import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
export function authorizeInternal(request: NextRequest) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return process.env.NODE_ENV !== "production";
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const a = Buffer.from(expected),
    b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
