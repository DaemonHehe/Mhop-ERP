import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mocks.limit,
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        mocks.set(values);
        return {
          where: mocks.where,
        };
      },
    }),
  },
}));

vi.mock("@/lib/services/audit.service", () => ({
  audit: mocks.audit,
}));

import {
  updateOrderPackedImages,
  type OperationalOrder,
} from "@/lib/services/order.service";

describe("Order Packed Stage Packaging Proof Photo Upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies OperationalOrder type contains packedImageUrl and packedImageUrls", () => {
    const mockOrder: OperationalOrder = {
      id: "test-order-id",
      orderCode: "MHOP-TEST-001",
      customer: "Test Customer",
      channel: "Web",
      amount: 50000,
      payment: "Verified",
      fulfillment: "Packed",
      item: "BlackShark Cooler",
      created: "2026-09-13",
      packedImageUrl: "/api/media/test-parcel-image-id",
      packedImageUrls: [
        "/api/media/test-parcel-image-id",
        "/api/media/test-box-image-id",
      ],
    };

    expect(mockOrder.packedImageUrl).toBe("/api/media/test-parcel-image-id");
    expect(mockOrder.packedImageUrls).toHaveLength(2);
    expect(mockOrder.packedImageUrls?.[1]).toBe("/api/media/test-box-image-id");
  });

  it("validates updateOrderPackedImages requires a valid orderId", async () => {
    const result = await updateOrderPackedImages("", "/api/media/123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Missing order ID/i);
    }
  });

  it("validates updateOrderPackedImages returns error for non-existent order", async () => {
    mocks.limit.mockResolvedValueOnce([]);
    const result = await updateOrderPackedImages("missing-order-id", "/api/media/123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Order not found/i);
    }
  });

  it("rejects packaging photo update on a cancelled order", async () => {
    mocks.limit.mockResolvedValueOnce([
      {
        id: "order-cancelled",
        orderCode: "MHOP-CAN-001",
        fulfillmentStatus: "cancelled",
      },
    ]);

    const result = await updateOrderPackedImages("order-cancelled", "/api/media/123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/cancelled order/i);
    }
  });

  it("updates packaging photo successfully for an order in packed stage", async () => {
    mocks.limit.mockResolvedValueOnce([
      {
        id: "order-packed-1",
        orderCode: "MHOP-PACK-001",
        fulfillmentStatus: "packed",
      },
    ]);
    mocks.where.mockResolvedValueOnce([{ id: "order-packed-1" }]);

    const result = await updateOrderPackedImages(
      "order-packed-1",
      "/api/media/img-parcel-1",
      ["/api/media/img-parcel-1", "/api/media/img-label-2"],
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.packedImageUrl).toBe("/api/media/img-parcel-1");
      expect(result.data?.packedImageUrls).toEqual([
        "/api/media/img-parcel-1",
        "/api/media/img-label-2",
      ]);
    }
    expect(mocks.set).toHaveBeenCalledWith({
      packedImageUrl: "/api/media/img-parcel-1",
      packedImageUrls: ["/api/media/img-parcel-1", "/api/media/img-label-2"],
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      "order.packaging_image_updated",
      "MHOP-PACK-001",
      expect.stringContaining("Packaging photo updated"),
    );
  });

  it("allows removing packaging photo by passing null", async () => {
    mocks.limit.mockResolvedValueOnce([
      {
        id: "order-packed-2",
        orderCode: "MHOP-PACK-002",
        fulfillmentStatus: "packed",
      },
    ]);
    mocks.where.mockResolvedValueOnce([{ id: "order-packed-2" }]);

    const result = await updateOrderPackedImages("order-packed-2", null, []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.packedImageUrl).toBeNull();
      expect(result.data?.packedImageUrls).toEqual([]);
    }
    expect(mocks.set).toHaveBeenCalledWith({
      packedImageUrl: null,
      packedImageUrls: [],
    });
  });
});
