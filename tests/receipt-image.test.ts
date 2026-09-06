import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderCustomerReceiptImage } from "@/lib/services/receipt-image";

describe("Telegram receipt image", () => {
  it("renders a branded PNG with enough room for order details", async () => {
    const image = await renderCustomerReceiptImage({
      orderCode: "MHOP-260906-TEST",
      customerName: "မောင်မောင်",
      phone: "09123456789",
      shippingAddress: "ရန်ကုန်မြို့ စမ်းချောင်းမြို့နယ်",
      shippingFee: 4500,
      totalAmount: 54500,
      paymentMethod: "kbzpay",
      items: [{ name: "Flydigi Cooling Fan", quantity: 1, unitPrice: 50000 }],
    });
    const metadata = await sharp(image).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(920);
    expect(metadata.height).toBeGreaterThanOrEqual(800);
    expect(image.byteLength).toBeGreaterThan(20_000);
  });
});
