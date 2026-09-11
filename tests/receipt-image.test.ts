import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  MAIN_RECEIPT_TELEGRAM_URL,
  renderCustomerReceiptImage,
  renderDepositRequestReceiptImage,
} from "@/lib/services/receipt-image";

describe("Telegram receipt image", () => {
  it("uses the requested Telegram destination for the main receipt QR", () => {
    expect(MAIN_RECEIPT_TELEGRAM_URL).toBe("https://t.me/KG7n1svJ7bxkNWRl");
  });

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

  it("renders a narrow 45mm deposit-request PNG with payment information", async () => {
    const image = await renderDepositRequestReceiptImage({
      orderCode: "MHOP-260912-DPST",
      customerName: "မောင်မောင်",
      phone: "09123456789",
      shippingAddress: "ရန်ကုန်မြို့",
      shippingFee: 5000,
      totalAmount: 255000,
      requiredDeposit: 10000,
      codAmount: 245000,
      paymentMethod: "kbzpay",
      items: [{ name: "Gaming Controller", quantity: 1, unitPrice: 250000 }],
      paymentAccount: {
        bankName: "KBZPay (KPay)",
        accountHolder: "MH OP",
        accountNumber: "09123456789",
      },
    });

    const metadata = await sharp(image).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(360);
    expect(metadata.height).toBeGreaterThanOrEqual(600);
    expect(image.byteLength).toBeGreaterThan(10_000);
  });
});
