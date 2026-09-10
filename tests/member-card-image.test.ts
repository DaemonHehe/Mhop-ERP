import { describe, expect, it } from "vitest";
import {
  renderMemberCardImage,
  formatCardNumber,
} from "@/lib/services/member-card-image";
import { getCardTier } from "@/lib/loyalty";

describe("Member Card Image Generator", () => {
  it("formats card numbers correctly into 4-segment luxury style", () => {
    expect(formatCardNumber(null)).toBe("MH • 7720 • 9104 • 8821");
    expect(formatCardNumber("cust-1234-abcd-5678")).toMatch(/^MH • /);
    expect(formatCardNumber("09971234567")).toContain("•");
  });

  it("correctly maps tiers and points to CardTier", () => {
    expect(getCardTier("member", 0)).toBe("classic");
    expect(getCardTier("member", 150)).toBe("classic");
    expect(getCardTier("silver", 300)).toBe("silver");
    expect(getCardTier("gold", 600)).toBe("gold");
    expect(getCardTier("platinum", 1200)).toBe("platinum");
    expect(getCardTier("platinum", 2600)).toBe("diamond");
    expect(getCardTier("diamond", 100)).toBe("diamond");
  });

  it("renders a valid PNG buffer for Classic tier", async () => {
    const png = await renderMemberCardImage({
      customerName: "Min Ko Ko",
      memberId: "MHOP-CUST-001",
      tier: "member",
      points: 85,
    });

    expect(png).toBeInstanceOf(Buffer);
    expect(png.length).toBeGreaterThan(5000);
    // PNG magic bytes: 0x89, 0x50, 0x4E, 0x47
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  });

  it("renders valid PNG buffers for all other tiers", async () => {
    const tiers = ["silver", "gold", "platinum", "diamond"] as const;

    for (const tier of tiers) {
      const png = await renderMemberCardImage({
        customerName: `VIP ${tier.toUpperCase()}`,
        memberId: `CUST-${tier}`,
        tier,
        points: tier === "diamond" ? 3500 : tier === "platinum" ? 1500 : 500,
      });

      expect(png).toBeInstanceOf(Buffer);
      expect(png.length).toBeGreaterThan(5000);
      expect(png[0]).toBe(0x89);
      expect(png[1]).toBe(0x50);
      expect(png[2]).toBe(0x4e);
      expect(png[3]).toBe(0x47);
    }
  });

  it("handles GET requests to /api/member-card route", async () => {
    const { GET } = await import("@/app/api/member-card/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost:3000/api/member-card?tier=gold&name=Demo%20User&points=850");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    const bytes = await res.arrayBuffer();
    const u8 = new Uint8Array(bytes);
    expect(u8[0]).toBe(0x89);
    expect(u8[1]).toBe(0x50);
    expect(u8[2]).toBe(0x4e);
    expect(u8[3]).toBe(0x47);
  });

  it("handles GET requests with customerCode to /api/member-card route", async () => {
    const { GET } = await import("@/app/api/member-card/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest(
      "http://localhost:3000/api/member-card?code=MH-CUST-8888&name=Min%20Thant&points=1200",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    const bytes = await res.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(5000);
  });
});

