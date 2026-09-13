import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import QRCode from "qrcode";
import { clientConfig } from "@/lib/client-config";
import type { ReceiptSummaryInput } from "./receipt-summary";

export const MAIN_RECEIPT_TELEGRAM_URL = "https://t.me/KG7n1svJ7bxkNWRl";

// Configure Fontconfig to discover Noto Sans and Noto Sans Myanmar in assets/fonts on Linux/Vercel
const fontsDir = path.join(process.cwd(), "assets", "fonts");
const fontsConfPath = path.join(fontsDir, "fonts.conf");
if (!process.env.FONTCONFIG_PATH) {
  process.env.FONTCONFIG_PATH = fontsDir;
}
if (!process.env.FONTCONFIG_FILE) {
  process.env.FONTCONFIG_FILE = fontsConfPath;
}
if (process.platform !== "win32") {
  try {
    fs.mkdirSync("/tmp/fonts-cache", { recursive: true });
  } catch {
    // ignore
  }
}

function xml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrap(value: string, limit = 36) {
  const words = value.trim().split(/\s+/u);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if ([...candidate].length <= limit) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    const chars = [...word];
    while (chars.length > limit) lines.push(chars.splice(0, limit).join(""));
    current = chars.join("");
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function orderLookupUrl(code: string) {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://mhop-erp-daemon.vercel.app"
  ).replace(/\/+$/, "");
  return `${appUrl}/orders?code=${encodeURIComponent(code)}`;
}

async function generateQr(value: string, size = 80) {
  const qrSvg = await QRCode.toString(value, {
    type: "svg",
    width: size,
    margin: 0,
    color: { dark: "#20221d", light: "#ffffff" },
  });
  const match = qrSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  return match ? match[1] : "";
}

/**
 * Renders the narrow first-stage receipt sent immediately after checkout.
 * At 203 DPI, 360 px is approximately 45 mm wide.
 */
export async function renderDepositRequestReceiptImage(
  order: ReceiptSummaryInput,
) {
  const WIDTH = 360;
  const PAD = 18;
  const CONTENT_W = WIDTH - PAD * 2;
  const subtotal =
    order.subtotal ?? Math.max(0, order.totalAmount - order.shippingFee);
  const depositDue = order.requiredDeposit ?? order.totalAmount;
  const itemRows = [
    ...(order.bundles || []).map((bundle) => ({
      name: `Bundle · ${bundle.name}`,
      quantity: 1,
      amount: bundle.price,
    })),
    ...order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      amount: item.unitPrice * item.quantity,
    })),
  ];
  const itemHeight = Math.max(1, itemRows.length) * 38;
  const account = order.paymentAccount || (() => {
    const method = order.paymentMethod.toLowerCase();
    if (method.includes("wave")) {
      return {
        bankName: clientConfig.payments.wavePay.label,
        accountHolder: clientConfig.payments.wavePay.holder,
        accountNumber: clientConfig.payments.wavePay.account,
      };
    }
    if (method.includes("bank")) {
      return {
        bankName: clientConfig.payments.bank.label,
        accountHolder: clientConfig.payments.bank.holder,
        accountNumber: clientConfig.payments.bank.account,
      };
    }
    return {
      bankName: clientConfig.payments.kbzPay.label,
      accountHolder: clientConfig.payments.kbzPay.holder,
      accountNumber: clientConfig.payments.kbzPay.account,
    };
  })();
  const itemsY = 174;
  const totalsY = itemsY + itemHeight + 20;
  const depositY = totalsY + 102;
  const accountY = depositY + 92;
  const footerY = accountY + 134;
  const totalHeight = footerY + 118;
  const issued = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Yangon",
    dateStyle: "short",
    timeStyle: "short",
  });
  const qrSvg = await generateQr(orderLookupUrl(order.orderCode), 64);

  const svg = `
  <svg width="${WIDTH}" height="${totalHeight}" viewBox="0 0 ${WIDTH} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .txt { font-family: 'Noto Sans', 'Noto Sans Myanmar', sans-serif; }
      .mono { font-family: 'Noto Sans', monospace; }
    </style>
    <rect width="${WIDTH}" height="${totalHeight}" fill="#ffffff"/>
    <rect x="0" y="0" width="${WIDTH}" height="8" fill="#252a20"/>

    <g transform="translate(${PAD}, 30)">
      <text x="0" y="18" class="txt" font-size="18" font-weight="900" fill="#171914">${xml(clientConfig.receipt.storeName)}</text>
      <text x="0" y="38" class="txt" font-size="9" font-weight="700" fill="#6b7066" letter-spacing="1.2">45 MM DEPOSIT REQUEST</text>
      <text x="${CONTENT_W}" y="18" text-anchor="end" class="txt" font-size="11" font-weight="900" fill="#171914">စရန်ငွေတောင်းခံလွှာ</text>
      <line x1="0" y1="54" x2="${CONTENT_W}" y2="54" stroke="#252a20" stroke-width="2"/>

      <text x="0" y="78" class="txt" font-size="9" fill="#6b7066">ORDER</text>
      <text x="${CONTENT_W}" y="78" text-anchor="end" class="mono" font-size="11" font-weight="800" fill="#20221d">${xml(order.orderCode)}</text>
      <text x="0" y="98" class="txt" font-size="9" fill="#6b7066">CUSTOMER</text>
      <text x="${CONTENT_W}" y="98" text-anchor="end" class="txt" font-size="10.5" font-weight="700" fill="#20221d">${xml(order.customerName)}</text>
      <text x="0" y="116" class="txt" font-size="9" fill="#6b7066">PHONE</text>
      <text x="${CONTENT_W}" y="116" text-anchor="end" class="mono" font-size="10" fill="#20221d">${xml(order.phone)}</text>
      <text x="0" y="136" class="txt" font-size="8.5" fill="#777b70">${xml(issued)}</text>
    </g>

    <g transform="translate(${PAD}, ${itemsY})">
      <text x="0" y="0" class="txt" font-size="9" font-weight="900" fill="#6b7066" letter-spacing="1">ORDER ITEMS</text>
      ${itemRows.map((item, index) => {
        const y = 18 + index * 38;
        const name = wrap(item.name, 27)[0];
        return `
          <text x="0" y="${y}" class="txt" font-size="10.5" font-weight="700" fill="#20221d">${xml(name)}</text>
          <text x="0" y="${y + 16}" class="txt" font-size="9" fill="#6b7066">Qty ${item.quantity}</text>
          <text x="${CONTENT_W}" y="${y + 16}" text-anchor="end" class="mono" font-size="9.5" font-weight="700" fill="#20221d">${item.amount.toLocaleString()} MMK</text>
        `;
      }).join("")}
      <line x1="0" y1="${itemHeight + 6}" x2="${CONTENT_W}" y2="${itemHeight + 6}" stroke="#d8dad3" stroke-width="1"/>
    </g>

    <g transform="translate(${PAD}, ${totalsY})">
      <text x="0" y="16" class="txt" font-size="10" fill="#666a60">Products subtotal</text>
      <text x="${CONTENT_W}" y="16" text-anchor="end" class="mono" font-size="10" fill="#20221d">${subtotal.toLocaleString()} MMK</text>
      <text x="0" y="38" class="txt" font-size="10" fill="#666a60">Delivery fee</text>
      <text x="${CONTENT_W}" y="38" text-anchor="end" class="mono" font-size="10" fill="#20221d">${order.shippingFee.toLocaleString()} MMK</text>
      <line x1="0" y1="50" x2="${CONTENT_W}" y2="50" stroke="#252a20" stroke-width="1"/>
      <text x="0" y="72" class="txt" font-size="12" font-weight="900" fill="#20221d">ORDER TOTAL</text>
      <text x="${CONTENT_W}" y="72" text-anchor="end" class="mono" font-size="12" font-weight="900" fill="#20221d">${order.totalAmount.toLocaleString()} MMK</text>
    </g>

    <g transform="translate(${PAD}, ${depositY})">
      <rect x="0" y="0" width="${CONTENT_W}" height="76" rx="8" fill="#252a20"/>
      <text x="${CONTENT_W / 2}" y="25" text-anchor="middle" class="txt" font-size="10" font-weight="800" fill="#d9ddcf" letter-spacing="1">PAY DEPOSIT NOW</text>
      <text x="${CONTENT_W / 2}" y="54" text-anchor="middle" class="mono" font-size="23" font-weight="900" fill="#ffffff">${depositDue.toLocaleString()} MMK</text>
    </g>

    <g transform="translate(${PAD}, ${accountY})">
      <rect x="0" y="0" width="${CONTENT_W}" height="118" rx="8" fill="#f3f4ef" stroke="#d8dad3"/>
      <text x="12" y="22" class="txt" font-size="9" font-weight="900" fill="#6b7066" letter-spacing="1">TRANSFER INFORMATION</text>
      <text x="12" y="45" class="txt" font-size="12" font-weight="900" fill="#20221d">${xml(account.bankName)}</text>
      <text x="12" y="65" class="txt" font-size="9.5" fill="#565a51">Account name</text>
      <text x="${CONTENT_W - 12}" y="65" text-anchor="end" class="txt" font-size="9.5" font-weight="700" fill="#20221d">${xml(account.accountHolder)}</text>
      <text x="12" y="86" class="txt" font-size="9.5" fill="#565a51">Account number</text>
      <text x="${CONTENT_W - 12}" y="86" text-anchor="end" class="mono" font-size="11" font-weight="900" fill="#20221d">${xml(account.accountNumber)}</text>
      <text x="12" y="105" class="txt" font-size="8.5" fill="#6b7066">Send the payment slip with this order code.</text>
    </g>

    <g transform="translate(${PAD}, ${footerY})">
      <text x="0" y="18" class="txt" font-size="9" font-weight="900" fill="#20221d">Payment Slip ကို @Mhopassistant_bot သို့ ပေးပို့ပါ ခင်ဗျာ၊</text>
      <text x="0" y="36" class="txt" font-size="8.5" fill="#565a51">Adminအတည်ပြုပြီးပါက အိမ်အရောက်ငွေချေ</text>
      <text x="0" y="50" class="txt" font-size="8.5" fill="#565a51">ရှင်းရမည့် အဓိကပြေစာကို ပို့ပေးပါမည်။</text>
      <g transform="translate(${CONTENT_W - 64}, 42)">${qrSvg}</g>
      <text x="0" y="78" class="txt" font-size="9" font-weight="700" fill="#20221d">Telegram ${xml(clientConfig.receipt.telegram)}</text>
      <text x="0" y="96" class="mono" font-size="8.5" fill="#6b7066">${xml(order.orderCode)}</text>
    </g>
  </svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/**
 * Renders the official MH OP Sales Voucher (အရောင်းဘောက်ချာ) matching the ERP Receipts Studio format.
 */
export async function renderCustomerReceiptImage(order: ReceiptSummaryInput) {
  let logoBuf: Buffer;
  try {
    const logoPath = path.join(process.cwd(), "public", "mhop-logo-minimal.jpg");
    logoBuf = await sharp(logoPath)
      .resize({ width: 88, height: 88, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .png()
      .toBuffer();
  } catch (err) {
    console.error("[renderCustomerReceiptImage logo load error, using blank]", err);
    logoBuf = await sharp({
      create: {
        width: 88,
        height: 88,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  }

  const WIDTH = 920;
  const PAD = 48;
  const CONTENT_W = WIDTH - PAD * 2;

  const qrSvg = await generateQr(MAIN_RECEIPT_TELEGRAM_URL, 80);

  const allRows: Array<{
    no: number;
    name: string;
    sku: string;
    warrantyMonths: number;
    qty: number;
    unit: string;
    price: number;
    disc: number;
    amount: number;
  }> = [];

  let count = 1;
  for (const bundle of order.bundles || []) {
    allRows.push({
      no: count++,
      name: `Bundle · ${bundle.name}`,
      sku: "BUNDLE",
      warrantyMonths: 6,
      qty: 1,
      unit: "Set",
      price: bundle.price,
      disc: 0,
      amount: bundle.price,
    });
  }
  for (const item of order.items) {
    allRows.push({
      no: count++,
      name: item.name,
      sku: item.sku || "MH-GADGET",
      warrantyMonths: 6,
      qty: item.quantity,
      unit: "Unit",
      price: item.unitPrice,
      disc: 0,
      amount: item.unitPrice * item.quantity,
    });
  }

  const rowH = 48;
  const tableH = 34 + allRows.length * rowH;

  const addressLines =
    order.shippingAddress === "Secure digital handover"
      ? ["Secure digital handover"]
      : wrap(order.shippingAddress, 38);

  const customerBoxY = 174;
  const customerBoxH = Math.max(106, 68 + addressLines.length * 18);
  const tableY = customerBoxY + customerBoxH + 16;
  const paymentBoxY = tableY + tableH + 18;
  const paymentBoxH = 140;
  const warrantyBoxY = paymentBoxY + paymentBoxH + 16;
  const warrantyBoxH = 142;
  const footerY = warrantyBoxY + warrantyBoxH + 18;
  const footerH = 136;
  const totalHeight = footerY + footerH + 36;

  const now = new Date();
  const issuedDate = now.toLocaleDateString("en-GB", { timeZone: "Asia/Yangon" });
  const issuedTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Yangon",
  });
  const courier =
    order.shippingAddress === "Secure digital handover"
      ? "Digital handover"
      : clientConfig.shipping?.courier || "Royal Express";

  const pMethod = order.paymentMethod.toLowerCase();
  const paymentLabel =
    pMethod.includes("kbz") || pMethod === "kbzpay"
      ? "KPay"
      : pMethod.includes("wave") || pMethod === "wavepay"
        ? "WavePay"
        : "KBZ Bank";
  const subtotal = order.subtotal ?? (order.totalAmount - order.shippingFee);

  const isPaidFull =
    order.customerPaymentStatus === "cod_collected" ||
    order.customerPaymentStatus === "fully_paid";
  const isDepositVerified = order.customerPaymentStatus === "deposit_verified";
  const hasDeposit = (order.requiredDeposit ?? 0) > 0;
  const depositPaid = isPaidFull
    ? order.totalAmount
    : order.customerPaidAmount ?? (isDepositVerified ? (order.requiredDeposit ?? 0) : 0);
  const remainingCod = isPaidFull
    ? 0
    : order.codAmount ?? Math.max(0, order.totalAmount - depositPaid);
  const balanceDue = isPaidFull
    ? 0
    : order.customerBalance ?? remainingCod;

  const svg = `
  <svg width="${WIDTH}" height="${totalHeight}" viewBox="0 0 ${WIDTH} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .txt { font-family: 'Noto Sans', 'Noto Sans Myanmar', sans-serif; }
      .mono { font-family: 'Noto Sans', monospace; }
    </style>
    <!-- Outer backdrop -->
    <rect width="${WIDTH}" height="${totalHeight}" fill="#f5f4ef"/>
    <!-- Document Card -->
    <rect x="24" y="24" width="${WIDTH - 48}" height="${totalHeight - 48}" rx="8" fill="#ffffff" stroke="#e3e5de" stroke-width="1"/>
    <!-- Low-opacity diagonal brand watermark behind receipt content -->
    <g transform="translate(${WIDTH / 2}, ${totalHeight / 2}) rotate(-32)" opacity="0.055">
      <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" class="txt" font-size="164" font-weight="900" letter-spacing="12" fill="#252a20">MH OP</text>
    </g>
    <!-- Top accent bar -->
    <rect x="24" y="24" width="${WIDTH - 48}" height="8" rx="4" fill="#252a20"/>

    <!-- Header -->
    <g transform="translate(${PAD}, 56)">
      <!-- Logo image -->
      <rect x="0" y="0" width="48" height="48" rx="8" fill="#000000" stroke="#252a20" stroke-width="1"/>
      <image href="data:image/png;base64,${logoBuf.toString("base64")}" x="4" y="4" width="40" height="40" preserveAspectRatio="xMidYMid meet"/>

      <!-- Store Name & Tagline -->
      <text x="62" y="22" class="txt" font-size="22" font-weight="900" fill="#171914" letter-spacing="-0.5">${xml(clientConfig.receipt.storeName)}</text>
      <text x="62" y="38" class="txt" font-size="9" font-weight="700" fill="#707469" letter-spacing="1.6">MOBILE GAMING ONE STOP SERVICE</text>

      <!-- Right Header: Title & Code -->
      <text x="${CONTENT_W}" y="12" text-anchor="end" class="txt" font-size="9" font-weight="700" fill="#73776d" letter-spacing="2">OFFICIAL SALES DOCUMENT</text>
      <text x="${CONTENT_W}" y="36" text-anchor="end" class="txt" font-size="22" font-weight="900" fill="#20221d">${xml(clientConfig.receipt.voucherTitle)}</text>
      <text x="${CONTENT_W}" y="52" text-anchor="end" class="mono" font-size="11" font-weight="700" fill="#20221d">${xml(order.orderCode)}</text>
    </g>

    <!-- Divider line -->
    <line x1="${PAD}" y1="128" x2="${WIDTH - PAD}" y2="128" stroke="#252a20" stroke-width="2"/>

    <!-- Socials bar -->
    <g transform="translate(${PAD}, 150)">
      <text x="0" y="0" class="txt" font-size="10" fill="#666a60">
        <tspan font-weight="800" fill="#292c26">Telegram </tspan>${xml(clientConfig.receipt.telegram)}
      </text>
      <text x="170" y="0" class="txt" font-size="10" fill="#666a60">
        <tspan font-weight="800" fill="#292c26">Viber </tspan>${xml(clientConfig.receipt.viber)}
      </text>
      <text x="330" y="0" class="txt" font-size="10" fill="#666a60">
        <tspan font-weight="800" fill="#292c26">TikTok </tspan>${xml(clientConfig.receipt.tiktok)}
      </text>
    </g>

    <!-- Two-column: SOLD TO & ISSUED/TIME/COURIER -->
    <g transform="translate(${PAD}, ${customerBoxY})">
      <!-- Left Card: Sold to -->
      <rect x="0" y="0" width="${CONTENT_W * 0.58}" height="${customerBoxH}" rx="10" fill="#f7f8f4" stroke="#dfe1da" stroke-width="1"/>
      <text x="16" y="24" class="txt" font-size="9" font-weight="900" fill="#777b70" letter-spacing="1.5">SOLD TO</text>
      <text x="16" y="48" class="txt" font-size="15" font-weight="900" fill="#1f211d">${xml(order.customerName)}</text>
      <text x="16" y="68" class="txt" font-size="11" fill="#565a51">${xml(order.phone)}</text>
      ${addressLines.map((line, i) => `<text x="16" y="${86 + i * 18}" class="txt" font-size="11" fill="#565a51">${xml(line)}</text>`).join("")}

      <!-- Right Card: Metadata -->
      <rect x="${CONTENT_W * 0.60}" y="0" width="${CONTENT_W * 0.40}" height="${customerBoxH}" rx="10" fill="#ffffff" stroke="#dfe1da" stroke-width="1"/>
      <g transform="translate(${CONTENT_W * 0.60 + 16}, 0)">
        <text x="0" y="32" class="txt" font-size="11" font-weight="600" fill="#777b70">Issued</text>
        <text x="${CONTENT_W * 0.40 - 32}" y="32" text-anchor="end" class="txt" font-size="11" font-weight="700" fill="#1f211d">${issuedDate}</text>

        <text x="0" y="60" class="txt" font-size="11" font-weight="600" fill="#777b70">Time</text>
        <text x="${CONTENT_W * 0.40 - 32}" y="60" text-anchor="end" class="txt" font-size="11" font-weight="700" fill="#1f211d">${issuedTime}</text>

        <text x="0" y="88" class="txt" font-size="11" font-weight="600" fill="#777b70">Courier</text>
        <text x="${CONTENT_W * 0.40 - 32}" y="88" text-anchor="end" class="txt" font-size="11" font-weight="700" fill="#1f211d">${xml(courier)}</text>
      </g>
    </g>

    <!-- Items Table -->
    <g transform="translate(${PAD}, ${tableY})">
      <rect x="0" y="0" width="${CONTENT_W}" height="${tableH}" rx="10" fill="#ffffff" stroke="#d8dad3" stroke-width="1"/>
      <!-- Header background -->
      <path d="M 0,10 A 10,10 0 0,1 10,0 L ${CONTENT_W - 10},0 A 10,10 0 0,1 ${CONTENT_W},10 L ${CONTENT_W},34 L 0,34 Z" fill="#252a20"/>
      
      <!-- Table Headers -->
      <text x="16" y="22" class="txt" font-size="9" font-weight="700" fill="#ffffff" letter-spacing="1">NO.</text>
      <text x="60" y="22" class="txt" font-size="9" font-weight="700" fill="#ffffff" letter-spacing="1">DESCRIPTION</text>
      <text x="490" y="22" text-anchor="middle" class="txt" font-size="9" font-weight="700" fill="#ffffff" letter-spacing="1">QTY</text>
      <text x="540" y="22" text-anchor="middle" class="txt" font-size="9" font-weight="700" fill="#ffffff" letter-spacing="1">UNIT</text>
      <text x="640" y="22" text-anchor="end" class="txt" font-size="9" font-weight="700" fill="#ffffff" letter-spacing="1">PRICE</text>
      <text x="710" y="22" text-anchor="middle" class="txt" font-size="9" font-weight="700" fill="#ffffff" letter-spacing="1">DISC</text>
      <text x="${CONTENT_W - 16}" y="22" text-anchor="end" class="txt" font-size="9" font-weight="700" fill="#ffffff" letter-spacing="1">AMOUNT</text>

      <!-- Table Rows -->
      ${allRows.map((item, idx) => {
        const rY = 34 + idx * rowH;
        const bg = idx % 2 === 1 ? `<rect x="1" y="${rY}" width="${CONTENT_W - 2}" height="${rowH}" fill="#fafbf8"/>` : "";
        return `
          ${bg}
          <line x1="0" y1="${rY}" x2="${CONTENT_W}" y2="${rY}" stroke="#e1e3dc" stroke-width="1"/>
          <text x="16" y="${rY + 22}" class="txt" font-size="11" fill="#74786e">${item.no}</text>
          <text x="60" y="${rY + 20}" class="txt" font-size="12" font-weight="700" fill="#1f211d">${xml(item.name)}</text>
          <text x="60" y="${rY + 36}" class="txt" font-size="9" fill="#74786e">${xml(item.sku)} · Warranty ${item.warrantyMonths} months</text>
          <text x="490" y="${rY + 22}" text-anchor="middle" class="txt" font-size="11" fill="#1f211d">${item.qty}</text>
          <text x="540" y="${rY + 22}" text-anchor="middle" class="txt" font-size="11" fill="#74786e">${item.unit}</text>
          <text x="640" y="${rY + 22}" text-anchor="end" class="txt" font-size="11" fill="#1f211d">${item.price.toLocaleString()}</text>
          <text x="710" y="${rY + 22}" text-anchor="middle" class="txt" font-size="11" fill="#74786e">${item.disc}%</text>
          <text x="${CONTENT_W - 16}" y="${rY + 22}" text-anchor="end" class="txt" font-size="11" font-weight="700" fill="#1f211d">${item.amount.toLocaleString()}</text>
        `;
      }).join("")}
    </g>

    <!-- Payment & Totals Section -->
    <g transform="translate(${PAD}, ${paymentBoxY})">
      <!-- Left: Payment details -->
      <g transform="translate(0, 0)">
        <text x="0" y="14" class="txt" font-size="9" font-weight="900" fill="#777b70" letter-spacing="1.5">PAYMENT &amp; STATUS</text>
        <text x="0" y="38" class="txt" font-size="15" font-weight="900" fill="#1f211d">${xml(paymentLabel)}</text>
        ${
          isPaidFull
            ? `
          <rect x="0" y="48" width="94" height="20" rx="10" fill="#e8f4cf"/>
          <text x="47" y="62" text-anchor="middle" class="txt" font-size="8.5" font-weight="900" fill="#34431a" letter-spacing="0.8">PAID IN FULL</text>
          <text x="0" y="86" class="txt" font-size="11" fill="#666a60">Total Received: <tspan font-weight="700" fill="#252820">${order.totalAmount.toLocaleString()} MMK</tspan></text>
          <text x="0" y="104" class="txt" font-size="10" font-weight="700" fill="#31520d">Customer Balance: 0 MMK</text>
        `
            : hasDeposit
              ? `
          <rect x="0" y="48" width="116" height="20" rx="10" fill="${depositPaid > 0 ? "#e0f2fe" : "#fff0cc"}"/>
          <text x="58" y="62" text-anchor="middle" class="txt" font-size="8.5" font-weight="900" fill="${depositPaid > 0 ? "#0369a1" : "#74530b"}" letter-spacing="0.8">${depositPaid > 0 ? "DEPOSIT VERIFIED" : "DEPOSIT PENDING"}</text>
          <text x="0" y="86" class="txt" font-size="11" fill="#666a60">Deposit Paid: <tspan font-weight="700" fill="#252820">${depositPaid.toLocaleString()} MMK</tspan></text>
          <text x="0" y="104" class="txt" font-size="10" font-weight="700" fill="#0369a1">Pay COD: ${remainingCod.toLocaleString()} MMK</text>
        `
              : `
          <rect x="0" y="48" width="80" height="20" rx="10" fill="#fff0cc"/>
          <text x="40" y="62" text-anchor="middle" class="txt" font-size="8.5" font-weight="900" fill="#74530b" letter-spacing="0.8">PENDING</text>
          <text x="0" y="86" class="txt" font-size="11" fill="#666a60">Received: <tspan font-weight="700" fill="#252820">${depositPaid.toLocaleString()} MMK</tspan></text>
          <text x="0" y="104" class="txt" font-size="10" font-weight="700" fill="#74530b">Balance Due: ${balanceDue.toLocaleString()} MMK</text>
        `
        }
      </g>

      <!-- Right: Totals Breakdown Box -->
      <g transform="translate(${CONTENT_W - 320}, 0)">
        <rect x="0" y="0" width="320" height="136" rx="10" fill="#f3f4ef"/>
        <g transform="translate(16, 0)">
          <text x="0" y="24" class="txt" font-size="10.5" fill="#666a60">Subtotal</text>
          <text x="288" y="24" text-anchor="end" class="txt" font-size="10.5" fill="#1f211d">${subtotal.toLocaleString()} MMK</text>

          <text x="0" y="44" class="txt" font-size="10.5" fill="#666a60">Delivery fee</text>
          <text x="288" y="44" text-anchor="end" class="txt" font-size="10.5" fill="#1f211d">${order.shippingFee.toLocaleString()} MMK</text>

          <line x1="0" y1="54" x2="288" y2="54" stroke="#ccd0c5" stroke-width="1"/>

          <text x="0" y="72" class="txt" font-size="13" font-weight="900" fill="#1f211d">Total</text>
          <text x="288" y="72" text-anchor="end" class="txt" font-size="13" font-weight="900" fill="#1f211d">${order.totalAmount.toLocaleString()} MMK</text>

          ${
            isPaidFull
              ? `
            <text x="0" y="92" class="txt" font-size="10" fill="#666a60">Paid in full</text>
            <text x="288" y="92" text-anchor="end" class="txt" font-size="10" font-weight="700" fill="#31520d">${order.totalAmount.toLocaleString()} MMK</text>

            <text x="0" y="114" class="txt" font-size="11" font-weight="900" fill="#1f211d">Customer balance</text>
            <text x="288" y="114" text-anchor="end" class="txt" font-size="11" font-weight="900" fill="#31520d">0 MMK</text>
          `
              : hasDeposit
                ? `
            <text x="0" y="90" class="txt" font-size="9.5" fill="#666a60">Verified Deposit</text>
            <text x="288" y="90" text-anchor="end" class="txt" font-size="9.5" font-weight="700" fill="#1f211d">${depositPaid.toLocaleString()} MMK</text>

            <text x="0" y="108" class="txt" font-size="9.5" font-weight="700" fill="#0369a1">COD on Delivery</text>
            <text x="288" y="108" text-anchor="end" class="txt" font-size="9.5" font-weight="900" fill="#0369a1">${remainingCod.toLocaleString()} MMK</text>

            <text x="0" y="126" class="txt" font-size="10.5" font-weight="900" fill="#1f211d">Balance due</text>
            <text x="288" y="126" text-anchor="end" class="txt" font-size="10.5" font-weight="900" fill="#1f211d">${balanceDue.toLocaleString()} MMK</text>
          `
                : `
            <text x="0" y="92" class="txt" font-size="10" fill="#666a60">Paid</text>
            <text x="288" y="92" text-anchor="end" class="txt" font-size="10" fill="#1f211d">${depositPaid.toLocaleString()} MMK</text>

            <text x="0" y="114" class="txt" font-size="11" font-weight="900" fill="#1f211d">Balance due</text>
            <text x="288" y="114" text-anchor="end" class="txt" font-size="11" font-weight="900" fill="#1f211d">${balanceDue.toLocaleString()} MMK</text>
          `
          }
        </g>
      </g>
    </g>

    <!-- Warranty Box -->
    <g transform="translate(${PAD}, ${warrantyBoxY})">
      <rect x="0" y="0" width="${CONTENT_W}" height="142" rx="10" fill="#fafbf8" stroke="#dfe1da" stroke-width="1"/>
      <text x="16" y="24" class="txt" font-size="11" font-weight="900" fill="#252820">Warranty Claim စည်းကမ်းချက်များ</text>
      <text x="${CONTENT_W - 16}" y="24" text-anchor="end" class="txt" font-size="8" font-weight="700" fill="#7c8075" letter-spacing="1.5">KEEP THIS VOUCHER</text>
      <line x1="16" y1="36" x2="${CONTENT_W - 16}" y2="36" stroke="#e2e4dd" stroke-width="1"/>

      ${clientConfig.receipt.warrantyTerms.map((term, i) => `
        <text x="16" y="${56 + i * 20}" class="txt" font-size="9.5" fill="#4c5047">${i + 1}. ${xml(term)}</text>
      `).join("")}
    </g>

    <!-- Footer -->
    <g transform="translate(${PAD}, ${footerY})">
      <line x1="0" y1="0" x2="${CONTENT_W}" y2="0" stroke="#dfe1da" stroke-width="1"/>

      <!-- Left: Thank you -->
      <text x="0" y="28" class="txt" font-size="15" font-weight="900" fill="#252820">ကျေးဇူးတင်ပါတယ်ခင်ဗျာ</text>
      <text x="0" y="46" class="txt" font-size="9.5" fill="#70746a">Thank you for choosing MH OP. Keep this original voucher as your proof of purchase and warranty record.</text>

      <!-- Right: Telegram QR Code -->
      <g transform="translate(${CONTENT_W - 190}, 45)">
        <text x="0" y="16" text-anchor="end" class="txt" font-size="9" font-weight="800" fill="#30332c">MH OP Telegram</text>
        <text x="0" y="30" text-anchor="end" class="txt" font-size="8" fill="#777b70">Scan to open</text>
        <text x="0" y="42" text-anchor="end" class="txt" font-size="8" fill="#777b70">our Telegram link</text>
      </g>
      <g transform="translate(${CONTENT_W - 80}, 20)">
        ${qrSvg}
      </g>
    </g>
  </svg>
  `;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
