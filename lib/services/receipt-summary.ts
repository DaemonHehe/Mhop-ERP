import { clientConfig } from "@/lib/client-config";
import { formatMMK } from "@/lib/data";

export interface ReceiptSummaryInput {
  orderCode: string;
  customerName: string;
  phone: string;
  shippingAddress: string;
  shippingFee: number;
  totalAmount: number;
  paymentMethod: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    sku?: string;
  }>;
  bundles?: Array<{
    name: string;
    price: number;
  }>;
}

/**
 * Format customer-facing order receipt for Telegram dispatch.
 */
export function formatCustomerReceipt(order: ReceiptSummaryInput): string {
  const lines: string[] = [];

  lines.push(`🧾 <b>${clientConfig.receipt.storeName} — အရောင်းပြေစာ</b>`);
  lines.push(`Order Code: <code>${order.orderCode}</code>`);
  lines.push(`အမည်: ${order.customerName}`);
  lines.push(`ဖုန်း: ${order.phone}`);
  if (order.shippingAddress && order.shippingAddress !== "Secure digital handover") {
    lines.push(`လိပ်စာ: ${order.shippingAddress}`);
  }
  lines.push("");
  lines.push("<b>ဝယ်ယူထားသော ပစ္စည်းများ—</b>");

  if (order.bundles && order.bundles.length > 0) {
    for (const bundle of order.bundles) {
      lines.push(`• 📦 ${bundle.name} — ${formatMMK(bundle.price)}`);
    }
  }

  for (const item of order.items) {
    const lineTotal = item.unitPrice * item.quantity;
    lines.push(`• ${item.name} (${item.quantity}×) — ${formatMMK(lineTotal)}`);
  }

  lines.push("");
  if (order.shippingFee > 0) {
    lines.push(`ပို့ဆောင်ခ (Delivery): ${formatMMK(order.shippingFee)}`);
  }
  lines.push(`<b>ကျသင့်ငွေ စုစုပေါင်း: ${formatMMK(order.totalAmount)}</b>`);
  lines.push("");

  // Payment information
  const paymentKey = order.paymentMethod.toLowerCase();
  let paymentInfo = "";
  if (paymentKey.includes("kbz") || paymentKey === "kbzpay") {
    const p = clientConfig.payments.kbzPay;
    paymentInfo = `${p.label}\nအကောင့်အမည်: ${p.holder}\nနံပါတ်: <code>${p.account}</code>`;
  } else if (paymentKey.includes("wave") || paymentKey === "wavepay") {
    const p = clientConfig.payments.wavePay;
    paymentInfo = `${p.label}\nအကောင့်အမည်: ${p.holder}\nနံပါတ်: <code>${p.account}</code>`;
  } else {
    const p = clientConfig.payments.bank;
    paymentInfo = `${p.label}\nအကောင့်အမည်: ${p.holder}\nအကောင့်နံပါတ်: <code>${p.account}</code>`;
  }

  lines.push("<b>ငွေပေးချေရန် အချက်အလက်များ—</b>");
  lines.push(paymentInfo);
  lines.push("");
  lines.push("📸 <b>Payment Slip ပေးပို့ရန်:</b>");
  lines.push(`ငွေလွှဲပြီးပါက ငွေလွှဲပြေစာ (Slip) ဓာတ်ပုံကို Order Code <code>${order.orderCode}</code> နှင့်အတူ ဤ Bot သို့ တိုက်ရိုက် ပေးပို့နိုင်ပါပြီခင်ဗျာ။`);
  lines.push("Admin Team မှ စစ်ဆေးအတည်ပြုပြီးပါက ပစ္စည်းထုတ်ပိုးပို့ဆောင်ပေးပါမည်။");

  return lines.join("\n");
}

/**
 * Format manager notification for Telegram staff/operations group.
 */
export function formatManagerOrderAlert(order: ReceiptSummaryInput): string {
  const lines: string[] = [];

  lines.push(`🔔 <b>အော်ဒါအသစ် ရောက်ရှိပါသည် (New Order)</b>`);
  lines.push(`Order Code: <code>${order.orderCode}</code>`);
  lines.push(`Customer: <b>${order.customerName}</b> (${order.phone})`);
  if (order.shippingAddress && order.shippingAddress !== "Secure digital handover") {
    lines.push(`Address: ${order.shippingAddress}`);
  }
  lines.push(`Payment Method: <b>${order.paymentMethod.toUpperCase()}</b>`);
  lines.push(`Total Amount: <b>${formatMMK(order.totalAmount)}</b>`);
  lines.push("");
  lines.push("<b>Items:</b>");

  if (order.bundles && order.bundles.length > 0) {
    for (const bundle of order.bundles) {
      lines.push(`• 📦 [Bundle] ${bundle.name} — ${formatMMK(bundle.price)}`);
    }
  }

  for (const item of order.items) {
    lines.push(`• ${item.name} (${item.quantity}×) — ${formatMMK(item.unitPrice * item.quantity)}`);
  }

  lines.push("");
  lines.push("⏳ <i>Status: Awaiting customer payment slip & admin manual verification.</i>");

  return lines.join("\n");
}
