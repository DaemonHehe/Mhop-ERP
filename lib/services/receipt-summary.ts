import { clientConfig } from "@/lib/client-config";
import { formatMMK } from "@/lib/data";

export interface ReceiptSummaryInput {
  orderCode: string;
  customerName: string;
  phone: string;
  shippingAddress: string;
  shippingFee: number;
  deliveryFee?: number;
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
  subtotal?: number;
  requiredDeposit?: number;
  customerPaidAmount?: number;
  customerBalance?: number;
  codAmount?: number;
  customerPaymentStatus?: string;
  destinationCity?: string | null;
  destinationState?: string | null;
  expectedCourierCost?: number;
  customerTier?: string;
  tierDiscountAmount?: number;
  tierDeliveryDiscount?: number;
  pointsEarned?: number;
  paymentAccount?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    instructions?: string | null;
  };
}

export function formatDepositRequestReceipt(
  order: ReceiptSummaryInput,
): string {
  const subtotal =
    order.subtotal ?? Math.max(0, order.totalAmount - order.shippingFee);
  const depositDue = order.requiredDeposit ?? order.totalAmount;
  const lines = [
    `🧾 <b>${clientConfig.receipt.storeName} — စရန်ငွေတောင်းခံလွှာ</b>`,
    `Order Code: <code>${order.orderCode}</code>`,
    `အမည်: ${order.customerName}`,
    `ဖုန်း: ${order.phone}`,
    "",
    `ပစ္စည်းစုစုပေါင်း: ${formatMMK(subtotal)}`,
    `ပို့ဆောင်ခ: ${formatMMK(order.shippingFee)}`,
    `<b>အော်ဒါစုစုပေါင်း: ${formatMMK(order.totalAmount)}</b>`,
    "",
    `💳 <b>ယခုပေးချေရမည့် စရန်ငွေ: ${formatMMK(depositDue)}</b>`,
    `ငွေလွှဲပြီးပါက Payment Slip ပုံနှင့် Order Code <code>${order.orderCode}</code> ကို ဤ Bot သို့ ပေးပို့ပါခင်ဗျာ။`,
    "Admin အတည်ပြုပြီးပါက Royal Express COD ပါသော အဓိကပြေစာကို ပို့ပေးပါမည်။",
  ];

  return lines.join("\n");
}

/**
 * Format customer-facing order receipt for Telegram dispatch.
 * Distinguishes between Deposit Confirmation and Final Paid Receipt.
 */
export function formatCustomerReceipt(order: ReceiptSummaryInput): string {
  const lines: string[] = [];
  const subtotal = order.subtotal ?? Math.max(0, order.totalAmount - order.shippingFee);
  const isPaidFull =
    order.customerPaymentStatus === "cod_collected" ||
    order.customerPaymentStatus === "fully_paid";
  const isDepositVerified = order.customerPaymentStatus === "deposit_verified";
  const hasDeposit = (order.requiredDeposit ?? 0) > 0;
  const remainingCod = order.codAmount ?? Math.max(0, order.totalAmount - (order.requiredDeposit ?? 0));

  if (isPaidFull) {
    lines.push(`🧾 <b>${clientConfig.receipt.storeName} — အရောင်းပြေစာ (Paid Receipt)</b>`);
  } else if (hasDeposit) {
    lines.push(`🧾 <b>${clientConfig.receipt.storeName} — စရန်ငွေပြေစာ (Deposit Confirmation)</b>`);
  } else {
    lines.push(`🧾 <b>${clientConfig.receipt.storeName} — အရောင်းပြေစာ</b>`);
  }

  lines.push(`Order Code: <code>${order.orderCode}</code>`);
  lines.push(`အမည်: ${order.customerName}`);
  lines.push(`ဖုန်း: ${order.phone}`);
  if (order.destinationCity) {
    lines.push(`မြို့နယ်: ${order.destinationCity}${order.destinationState ? ` (${order.destinationState})` : ""}`);
  }
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
  lines.push(`ပစ္စည်းစုစုပေါင်း (Subtotal): ${formatMMK(subtotal)}`);
  if (order.tierDiscountAmount && order.tierDiscountAmount > 0) {
    lines.push(`🎁 VIP လျှော့စျေး (${(order.customerTier || "VIP").toUpperCase()}): -${formatMMK(order.tierDiscountAmount)}`);
  }
  if (order.shippingFee > 0) {
    lines.push(`ပို့ဆောင်ခ (Delivery Fee): ${formatMMK(order.shippingFee)}`);
  } else if (order.tierDeliveryDiscount && order.tierDeliveryDiscount > 0) {
    lines.push(`🚚 ပို့ဆောင်ခ: အခမဲ့ (VIP Perk)`);
  }
  lines.push(`<b>ကျသင့်ငွေ စုစုပေါင်း: ${formatMMK(order.totalAmount)}</b>`);
  if (order.pointsEarned && order.pointsEarned > 0) {
    lines.push(`⭐ ရရှိမည့် Loyalty Point: +${order.pointsEarned} pts`);
  }
  lines.push("--------------------------------");

  if (isPaidFull) {
    lines.push(`✅ <b>ပေးချေပြီးငွေ (Paid in Full): ${formatMMK(order.totalAmount)}</b>`);
    lines.push(`ကျန်ရှိငွေ (Balance Due): <b>0 MMK</b>`);
    lines.push("");
    lines.push("✨ <i>လူကြီးမင်း၏ ပေးချေမှု အောင်မြင်စွာ ပြီးဆုံးပြီး ဖြစ်ပါသည်ခင်ဗျာ။ အားပေးမှုကို အထူးပင် ကျေးဇူးတင်ရှိပါသည်။</i>");
  } else if (hasDeposit) {
    lines.push(`စရန်ငွေ (Required Deposit): ${formatMMK(order.requiredDeposit!)}`);
    lines.push(`📦 <b>Royal Express COD (ပစ္စည်းရောက်မှ ပေးချေရန်): ${formatMMK(remainingCod)}</b>`);
    lines.push("");

    if (isDepositVerified) {
      lines.push(`✅ <b>စရန်ငွေ ${formatMMK(order.requiredDeposit!)} လက်ခံအတည်ပြုပြီးပါပြီခင်ဗျာ။</b>`);
      lines.push(`ကျန်ရှိငွေ <b>${formatMMK(remainingCod)}</b> ကို Royal Express ပစ္စည်းရောက်ရှိချိန်တွင် ပေးချေပေးပါခင်ဗျာ။`);
    } else {
      lines.push(`⏳ <b>စရန်ငွေ ${formatMMK(order.requiredDeposit!)} ပေးချေရန် လိုအပ်ပါသည်ခင်ဗျာ။</b>`);
      lines.push(`(ကျန်ရှိငွေ <b>${formatMMK(remainingCod)}</b> ကို ပစ္စည်းရောက်မှ Royal Express သို့ ပေးချေရပါမည်)`);
      lines.push("");
      lines.push("<b>စရန်ငွေ ပေးချေရန် အချက်အလက်များ—</b>");

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
      lines.push(paymentInfo);
      lines.push("");
      lines.push("📸 <b>Payment Slip ပေးပို့ရန်:</b>");
      lines.push(`ငွေလွှဲပြီးပါက စရန်ငွေပြေစာ (Slip) ကို Order Code <code>${order.orderCode}</code> နှင့်အတူ ပေးပို့ပေးပါခင်ဗျာ။`);
    }
  } else {
    // Digital full payment orders (e.g. PUBG accounts)
    lines.push(`ပေးချေရမည့်ငွေ: <b>${formatMMK(order.totalAmount)}</b>`);
    lines.push("");
    lines.push("<b>ငွေပေးချေရန် အချက်အလက်များ—</b>");
    const p = clientConfig.payments.kbzPay;
    lines.push(`${p.label}\nအကောင့်အမည်: ${p.holder}\nနံပါတ်: <code>${p.account}</code>`);
    lines.push("");
    lines.push("📸 <b>Payment Slip ပေးပို့ရန်:</b>");
    lines.push(`ငွေလွှဲပြီးပါက Slip ဓာတ်ပုံကို Order Code <code>${order.orderCode}</code> နှင့်အတူ ပေးပို့နိုင်ပါပြီခင်ဗျာ။`);
  }

  return lines.join("\n");
}

/**
 * Format manager notification for Telegram staff/operations group.
 */
export function formatManagerOrderAlert(order: ReceiptSummaryInput): string {
  const lines: string[] = [];
  const subtotal = order.subtotal ?? Math.max(0, order.totalAmount - order.shippingFee);
  const deposit = order.requiredDeposit ?? 0;
  const cod = order.codAmount ?? Math.max(0, order.totalAmount - deposit);
  const expectedCourier = order.expectedCourierCost ?? 0;
  const expectedTransfer = cod > 0 ? cod - expectedCourier : 0;

  lines.push(`🔔 <b>အော်ဒါအသစ် ရောက်ရှိပါသည် (New Order)</b>`);
  lines.push(`Order Code: <code>${order.orderCode}</code>`);
  lines.push(`Customer: <b>${order.customerName}</b> (${order.phone})`);
  if (order.destinationCity) {
    lines.push(`Destination: <b>${order.destinationCity}</b>${order.destinationState ? ` (${order.destinationState})` : ""}`);
  }
  if (order.shippingAddress && order.shippingAddress !== "Secure digital handover") {
    lines.push(`Address: ${order.shippingAddress}`);
  }
  lines.push(`Payment Method: <b>${order.paymentMethod.toUpperCase()}</b>`);
  lines.push(`Subtotal: <b>${formatMMK(subtotal)}</b> | Delivery: <b>${formatMMK(order.shippingFee)}</b>`);
  lines.push(`Total Amount: <b>${formatMMK(order.totalAmount)}</b>`);
  if (deposit > 0) {
    lines.push(`Required Deposit: <b>${formatMMK(deposit)}</b>`);
    lines.push(`Royal COD to collect: <b>${formatMMK(cod)}</b>`);
    if (expectedCourier > 0) {
      lines.push(`Expected Royal Deduction: <b>${formatMMK(expectedCourier)}</b> | Expected Shop Transfer: <b>${formatMMK(expectedTransfer)}</b>`);
    }
  }
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
  lines.push("⏳ <i>Status: Awaiting customer deposit verification & warehouse packing.</i>");

  return lines.join("\n");
}
