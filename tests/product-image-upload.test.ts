import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { catalogItemSchema } from "@/lib/validation/schemas";
import {
  processAndSaveImage,
  getMediaById,
} from "@/lib/services/media.service";
import {
  toPublicCatalogItem,
  type InventoryItem,
} from "@/lib/services/stock.service";

describe("Product & PUBG Account Image Uploads and Multi-Image Support", () => {
  describe("CatalogItemSchema Image Validation", () => {
    const baseGadget = {
      name: "BlackShark Cooler DL05",
      brand: "Black Shark",
      category: "Gaming Gadgets",
      subcategory: "Cooling Fans",
      sku: "BS-DL05-RGB",
      price: "65000",
      costPrice: "45000",
      warrantyMonths: "6",
      stockQuantity: "10",
      lowStockThreshold: "2",
    };

    it("accepts valid https image URLs and relative media paths", () => {
      const parsedHttps = catalogItemSchema.parse({
        ...baseGadget,
        imageUrl: "https://images.unsplash.com/photo-12345",
      });
      expect(parsedHttps.imageUrl).toBe(
        "https://images.unsplash.com/photo-12345",
      );

      const parsedMedia = catalogItemSchema.parse({
        ...baseGadget,
        imageUrl: "/api/media/e7b275b8-01d2-4d9c-b772-e6a06518f5fa",
      });
      expect(parsedMedia.imageUrl).toBe(
        "/api/media/e7b275b8-01d2-4d9c-b772-e6a06518f5fa",
      );
    });

    it("rejects invalid or unsafe image protocols like javascript:", () => {
      const res = catalogItemSchema.safeParse({
        ...baseGadget,
        imageUrl: "javascript:alert(1)",
      });
      expect(res.success).toBe(false);
    });

    it("supports multiple image URLs for PUBG accounts", () => {
      const pubgInput = {
        name: "PUBG Glacier Account",
        brand: "PUBG Mobile",
        category: "PUBG Accounts",
        subcategory: "Starter Accounts",
        sku: "PUBG-GLACIER-01",
        price: "250000",
        costPrice: "200000",
        warrantyMonths: "0",
        stockQuantity: "0",
        lowStockThreshold: "0",
        imageUrl: "/api/media/cover-screenshot",
        imageUrls: [
          "/api/media/cover-screenshot",
          "/api/media/lobby-screenshot",
          "/api/media/inventory-screenshot",
          "/api/media/weapons-screenshot",
        ],
      };

      const parsed = catalogItemSchema.parse(pubgInput);
      expect(parsed.imageUrl).toBe("/api/media/cover-screenshot");
      expect(parsed.imageUrls).toHaveLength(4);
      expect(parsed.imageUrls).toEqual([
        "/api/media/cover-screenshot",
        "/api/media/lobby-screenshot",
        "/api/media/inventory-screenshot",
        "/api/media/weapons-screenshot",
      ]);
    });
  });

  describe("Media Processing with Sharp", () => {
    it("compresses and saves an uploaded image into WebP format", async () => {
      // Create a test 200x200 PNG buffer
      const testBuffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 4,
          background: { r: 50, g: 150, b: 250, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const saved = await processAndSaveImage(testBuffer, "test-gadget.png");
      expect(saved.id).toBeDefined();
      expect(saved.url).toBe(`/api/media/${saved.id}`);
      expect(saved.mimeType).toBe("image/webp");
      expect(saved.sizeBytes).toBeGreaterThan(0);

      // Verify retrieval
      const loaded = await getMediaById(saved.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.mimeType).toBe("image/webp");

      // Verify Sharp can read the resulting WebP
      const metadata = await sharp(loaded!.buffer).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(200);
    });
  });

  describe("Public Catalog Multi-Image Preservation", () => {
    it("preserves images array for PUBG account storefront view", () => {
      const pubgItem: InventoryItem = {
        id: "pubg-item-1",
        variantId: "variant-1",
        name: "PUBG Mobile Conqueror Account",
        brand: "PUBG Mobile",
        category: "PUBG Accounts",
        subcategory: "Competitive Accounts",
        image: "/api/media/img1.webp",
        images: [
          "/api/media/img1.webp",
          "/api/media/img2.webp",
          "/api/media/img3.webp",
        ],
        sku: "PUBG-CONQ-01",
        color: null,
        storage: null,
        ram: null,
        condition: "Verified Digital Account",
        price: 350000,
        cost: 300000,
        stock: 0,
        warranty: 0,
        tagline: "PUBG Mobile PUBG Accounts",
        specs: [],
        description: "Full glacier max set",
        lowStockThreshold: 0,
        listingStatus: "available",
      };

      const publicItem = toPublicCatalogItem(pubgItem);
      expect(publicItem.image).toBe("/api/media/img1.webp");
      expect(publicItem.images).toEqual([
        "/api/media/img1.webp",
        "/api/media/img2.webp",
        "/api/media/img3.webp",
      ]);
      expect(publicItem.availability).toBe("available");
    });
  });
});
