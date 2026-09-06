import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { clientConfig } from "@/lib/client-config";
import type { ReceiptSummaryInput } from "./receipt-summary";

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

function generateBarcode(code: string, width = 250, height = 36) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CODE128 = (JsBarcode as any).getModule("CODE128");
  const encoder = new CODE128(code, {});
  const { data } = encoder.encode();
  const barWidth = width / data.length;
  let rects = "";
  for (let i = 0; i < data.length; i++) {
    if (data[i] === "1") {
      rects += `<rect x="${(i * barWidth).toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${height}" fill="#20221d"/>`;
    }
  }
  return {
    width,
    height: height + 16,
    svg: `<g transform="translate(0, 0)">${rects}<text x="${width / 2}" y="${height + 12}" text-anchor="middle" font-family="'Noto Sans', monospace" font-size="9" font-weight="700" fill="#20221d">${xml(code)}</text></g>`,
  };
}

async function generateQr(code: string, size = 80) {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://mhop-erp-daemon.vercel.app"
  ).replace(/\/+$/, "");
  const url = `${appUrl}/orders?code=${encodeURIComponent(code)}`;
  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    width: size,
    margin: 0,
    color: { dark: "#20221d", light: "#ffffff" },
  });
  const match = qrSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  return match ? match[1] : "";
}

/**
 * Renders the official MH OP Sales Voucher (အရောင်းဘောက်ချာ) matching the ERP Receipts Studio format.
 */
export async function renderCustomerReceiptImage(order: ReceiptSummaryInput) {
  let logoBuf: Buffer;
  try {
    const logoPath = path.join(process.cwd(), "public", "mhop-logo-minimal.jpg");
    logoBuf = await sharp(logoPath)
      .extract({ left: 115, top: 295, width: 790, height: 430 })
      .resize({ width: 44, height: 44, fit: "fill" })
      .png()
      .toBuffer();
  } catch (err) {
    console.error("[renderCustomerReceiptImage logo load error, using blank]", err);
    logoBuf = await sharp({
      create: {
        width: 44,
        height: 44,
        channels: 4,
        background: { r: 32, g: 34, b: 29, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  }

  const WIDTH = 920;
  const PAD = 48;
  const CONTENT_W = WIDTH - PAD * 2;

  const barcode = generateBarcode(order.orderCode, 250, 36);
  const qrSvg = await generateQr(order.orderCode, 80);

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
  const subtotal = order.totalAmount - order.shippingFee;

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
    <!-- Top accent bar -->
    <rect x="24" y="24" width="${WIDTH - 48}" height="8" rx="4" fill="#252a20"/>

    <!-- Header -->
    <g transform="translate(${PAD}, 56)">
      <!-- Logo image -->
      <rect x="0" y="0" width="48" height="48" rx="8" fill="#ffffff" stroke="#e0e2db" stroke-width="1"/>
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
        <text x="0" y="14" class="txt" font-size="9" font-weight="900" fill="#777b70" letter-spacing="1.5">PAYMENT</text>
        <text x="0" y="40" class="txt" font-size="15" font-weight="900" fill="#1f211d">${xml(paymentLabel)}</text>
        <!-- Status badge -->
        <rect x="52" y="27" width="70" height="18" rx="9" fill="#fff0cc"/>
        <text x="87" y="40" text-anchor="middle" class="txt" font-size="8" font-weight="900" fill="#74530b" letter-spacing="1">PENDING</text>
        <text x="0" y="64" class="txt" font-size="11" fill="#666a60">Received: <tspan font-weight="700" fill="#252820">0 MMK</tspan></text>
      </g>

      <!-- Right: Totals Breakdown Box -->
      <g transform="translate(${CONTENT_W - 320}, 0)">
        <rect x="0" y="0" width="320" height="136" rx="10" fill="#f3f4ef"/>
        <g transform="translate(16, 0)">
          <text x="0" y="28" class="txt" font-size="11" fill="#666a60">Subtotal</text>
          <text x="288" y="28" text-anchor="end" class="txt" font-size="11" fill="#1f211d">${subtotal.toLocaleString()} MMK</text>

          <text x="0" y="52" class="txt" font-size="11" fill="#666a60">Delivery fee</text>
          <text x="288" y="52" text-anchor="end" class="txt" font-size="11" fill="#1f211d">${order.shippingFee.toLocaleString()} MMK</text>

          <line x1="0" y1="64" x2="288" y2="64" stroke="#ccd0c5" stroke-width="1"/>

          <text x="0" y="86" class="txt" font-size="14" font-weight="900" fill="#1f211d">Total</text>
          <text x="288" y="86" text-anchor="end" class="txt" font-size="14" font-weight="900" fill="#1f211d">${order.totalAmount.toLocaleString()} MMK</text>

          <text x="0" y="106" class="txt" font-size="10" fill="#666a60">Paid</text>
          <text x="288" y="106" text-anchor="end" class="txt" font-size="10" fill="#1f211d">0 MMK</text>

          <text x="0" y="124" class="txt" font-size="11" font-weight="900" fill="#1f211d">Balance due</text>
          <text x="288" y="124" text-anchor="end" class="txt" font-size="11" font-weight="900" fill="#1f211d">${order.totalAmount.toLocaleString()} MMK</text>
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

      <!-- Left: Thank you & Barcode -->
      <text x="0" y="28" class="txt" font-size="15" font-weight="900" fill="#252820">ကျေးဇူးတင်ပါတယ်ခင်ဗျာ</text>
      <text x="0" y="46" class="txt" font-size="9.5" fill="#70746a">Thank you for choosing MH OP. Keep this original voucher as your proof of purchase and warranty record.</text>

      <g transform="translate(0, 58)">
        ${barcode.svg}
      </g>

      <!-- Right: QR Code & Reference text -->
      <g transform="translate(${CONTENT_W - 190}, 45)">
        <text x="0" y="16" text-anchor="end" class="txt" font-size="9" font-weight="800" fill="#30332c">Order reference</text>
        <text x="0" y="30" text-anchor="end" class="txt" font-size="8" fill="#777b70">Scan to identify</text>
        <text x="0" y="42" text-anchor="end" class="txt" font-size="8" fill="#777b70">this transaction</text>
      </g>
      <g transform="translate(${CONTENT_W - 80}, 20)">
        ${qrSvg}
      </g>
    </g>
  </svg>
  `;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
