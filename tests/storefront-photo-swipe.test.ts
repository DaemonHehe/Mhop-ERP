import { describe, expect, it } from "vitest";

describe("Storefront Photo Swipe & Gallery Gestures", () => {
  // Swipe detection algorithm matching Storefront implementation
  function computeSwipe({
    startX,
    startY,
    endX,
    endY,
    threshold = 35,
  }: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    threshold?: number;
  }): "next" | "prev" | "none" {
    const diffX = endX - startX;
    const diffY = endY - startY;

    if (Math.abs(diffX) > threshold && Math.abs(diffX) > Math.abs(diffY)) {
      return diffX < 0 ? "next" : "prev";
    }
    return "none";
  }

  function advanceIndex(currentIndex: number, total: number, direction: "next" | "prev"): number {
    if (total <= 1) return 0;
    if (direction === "next") {
      return (currentIndex + 1) % total;
    }
    return (currentIndex - 1 + total) % total;
  }

  describe("Swipe Gesture Threshold & Angle Detection", () => {
    it("recognizes horizontal swipe left as 'next'", () => {
      // Swiping finger from X=250 to X=150 (moved 100px left, 10px down)
      const action = computeSwipe({
        startX: 250,
        startY: 100,
        endX: 150,
        endY: 110,
      });
      expect(action).toBe("next");
    });

    it("recognizes horizontal swipe right as 'prev'", () => {
      // Swiping finger from X=100 to X=200 (moved 100px right, 5px up)
      const action = computeSwipe({
        startX: 100,
        startY: 200,
        endX: 200,
        endY: 195,
      });
      expect(action).toBe("prev");
    });

    it("ignores vertical page scroll gestures (does not hijack scroll)", () => {
      // User is scrolling down the page: moved 20px horizontally, 120px vertically
      const action = computeSwipe({
        startX: 150,
        startY: 200,
        endX: 170,
        endY: 320,
      });
      expect(action).toBe("none");
    });

    it("ignores tiny finger jitters and subtle taps below threshold (< 35px)", () => {
      // Finger moved only 15px
      const action = computeSwipe({
        startX: 150,
        startY: 150,
        endX: 165,
        endY: 152,
      });
      expect(action).toBe("none");
    });
  });

  describe("Gallery Index Wrapping & Clamping", () => {
    const totalPhotos = 4; // Photos at indices 0, 1, 2, 3

    it("wraps forward from last photo to first photo seamlessly", () => {
      let idx = 3;
      idx = advanceIndex(idx, totalPhotos, "next");
      expect(idx).toBe(0);
    });

    it("wraps backward from first photo to last photo seamlessly", () => {
      let idx = 0;
      idx = advanceIndex(idx, totalPhotos, "prev");
      expect(idx).toBe(3);
    });

    it("advances sequentially from photo 0 to photo 3", () => {
      let idx = 0;
      idx = advanceIndex(idx, totalPhotos, "next"); // 1
      expect(idx).toBe(1);
      idx = advanceIndex(idx, totalPhotos, "next"); // 2
      expect(idx).toBe(2);
      idx = advanceIndex(idx, totalPhotos, "next"); // 3
      expect(idx).toBe(3);
    });

    it("handles single-photo products gracefully with zero wrap or drift", () => {
      const singleTotal = 1;
      expect(advanceIndex(0, singleTotal, "next")).toBe(0);
      expect(advanceIndex(0, singleTotal, "prev")).toBe(0);
    });
  });

  describe("Product Photo Normalization", () => {
    it("falls back to single image array if images array is undefined", () => {
      const p: { name: string; image?: string; images?: string[] } = {
        name: "Cooler",
        image: "https://example.com/cooler.jpg",
        images: undefined,
      };

      const resolved = p.images && p.images.length > 0
        ? p.images
        : p.image
          ? [p.image]
          : ["/placeholder.svg"];

      expect(resolved).toEqual(["https://example.com/cooler.jpg"]);
      expect(resolved.length).toBe(1);
    });

    it("resolves multi-image array properly when uploaded by admin", () => {
      const p = {
        name: "Razer Headset",
        image: "https://example.com/front.jpg",
        images: [
          "https://example.com/front.jpg",
          "https://example.com/side.jpg",
          "https://example.com/box.jpg",
        ],
      };

      const resolved = p.images && p.images.length > 0
        ? p.images
        : p.image
          ? [p.image]
          : ["/placeholder.svg"];

      expect(resolved.length).toBe(3);
      expect(resolved[1]).toBe("https://example.com/side.jpg");
    });
  });
});
