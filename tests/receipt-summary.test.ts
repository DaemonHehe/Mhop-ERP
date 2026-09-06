import { describe, expect, it } from "vitest";
import {
  formatCustomerReceipt,
  formatManagerOrderAlert,
} from "@/lib/services/receipt-summary";

describe("Receipt summary generator", () => {
  const sampleOrder = {
    orderCode: "MHOP-260905-AB12",
    customerName: "Kyaw Kyaw",
    phone: "09798888123",
    shippingAddress: "No. 123, Insein Road, Yangon",
    shippingFee: 4500,
    totalAmount: 54500,
    paymentMethod: "kbzpay",
    items: [
      {
        name: "Flydigi Cooling Fan",
        quantity: 1,
        unitPrice: 50000,
        sku: "FLY-COOL-01",
      },
    ],
  };

  it("generates formatted customer receipt with payment and slip instructions", () => {
    const text = formatCustomerReceipt(sampleOrder);
    expect(text).toContain("MHOP-260905-AB12");
    expect(text).toContain("Kyaw Kyaw");
    expect(text).toContain("Flydigi Cooling Fan");
    expect(text).toContain("54,500 MMK");
    expect(text).toContain("KBZPay");
    expect(text).toContain("Payment Slip ပေးပို့ရန်");
  });

  it("generates manager order notification alert with all details", () => {
    const alert = formatManagerOrderAlert(sampleOrder);
    expect(alert).toContain("အော်ဒါအသစ် ရောက်ရှိပါသည်");
    expect(alert).toContain("MHOP-260905-AB12");
    expect(alert).toContain("Kyaw Kyaw");
    expect(alert).toContain("KBZPAY");
    expect(alert).toContain("54,500 MMK");
    expect(alert).toContain("Flydigi Cooling Fan");
  });

  it("supports bundles in receipt and manager alert", () => {
    const orderWithBundle = {
      ...sampleOrder,
      bundles: [{ name: "Rank Push Bundle", price: 75000 }],
    };
    const customerText = formatCustomerReceipt(orderWithBundle);
    expect(customerText).toContain("Rank Push Bundle");

    const managerText = formatManagerOrderAlert(orderWithBundle);
    expect(managerText).toContain("Rank Push Bundle");
  });
});
