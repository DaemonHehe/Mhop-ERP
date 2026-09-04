import { describe, expect, it } from "vitest";
import { isPublicRoute } from "@/lib/auth/route-policy";

describe("customer and staff route boundaries", () => {
  it.each([
    "/",
    "/login",
    "/shop",
    "/shop/checkout",
    "/shop/compare",
    "/warranty",
    "/api/telegram/webhook",
    "/api/n8n/webhook",
    "/api/internal/stats/daily",
  ])("keeps %s public", (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  it.each([
    "/dashboard",
    "/orders",
    "/inventory",
    "/customers",
    "/erp",
    "/staff",
    "/api/events",
    "/api/reports/monthly",
  ])("protects %s", (path) => {
    expect(isPublicRoute(path)).toBe(false);
  });

  it("does not allow lookalike routes through a public prefix", () => {
    expect(isPublicRoute("/shopper-dashboard")).toBe(false);
    expect(isPublicRoute("/warranty-admin")).toBe(false);
    expect(isPublicRoute("/api/internal-tools")).toBe(false);
  });
});
