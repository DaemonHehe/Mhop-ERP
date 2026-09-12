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

    it("preserves images array and description for Gaming Gadget storefront view", () => {
      const gadget: InventoryItem = {
        id: "gadget-item-1",
        variantId: "variant-gadget-1",
        name: "Flydigi Apex 4 Gaming Controller",
        brand: "Flydigi",
        category: "Gaming Gadgets",
        subcategory: "Controllers",
        image: "/api/media/apex4-front.webp",
        images: [
          "/api/media/apex4-front.webp",
          "/api/media/apex4-back.webp",
          "/api/media/apex4-box.webp",
        ],
        sku: "FDG-APEX4-WHT",
        color: "White",
        storage: null,
        ram: null,
        condition: "Brand New Sealed",
        price: 245000,
        cost: 180000,
        stock: 5,
        warranty: 12,
        tagline: "Adjustable force feedback triggers",
        specs: [{ label: "Sticks", value: "Hall Effect" }],
        description:
          "Official Flydigi Apex 4 wireless gaming controller with adjustable tension alloy sticks, full color interactive screen, and 1000Hz polling rate.",
        lowStockThreshold: 2,
        listingStatus: "available",
      };

      const publicItem = toPublicCatalogItem(gadget);
      expect(publicItem.image).toBe("/api/media/apex4-front.webp");
      expect(publicItem.images).toHaveLength(3);
      expect(publicItem.images).toEqual([
        "/api/media/apex4-front.webp",
        "/api/media/apex4-back.webp",
        "/api/media/apex4-box.webp",
      ]);
      expect(publicItem.description).toContain("Official Flydigi Apex 4");
      expect(publicItem.availability).toBe("available");
    });
  });
});
