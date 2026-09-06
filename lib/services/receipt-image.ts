import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { clientConfig } from "@/lib/client-config";
import { formatMMK } from "@/lib/data";
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

const WIDTH = 1080;
const LEFT = 86;

function xml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrap(value: string, limit = 42) {
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

function paymentDetails(method: string) {
  const key = method.toLowerCase();
  if (key.includes("kbz") || key === "kbzpay") return clientConfig.payments.kbzPay;
  if (key.includes("wave") || key === "wavepay") return clientConfig.payments.wavePay;
  return clientConfig.payments.bank;
}

export async function renderCustomerReceiptImage(order: ReceiptSummaryInput) {
  const logoPath = path.join(process.cwd(), "public", "mhop-logo-minimal.jpg");
  const logo = await sharp(logoPath)
    .extract({ left: 115, top: 295, width: 790, height: 430 })
    .resize({ width: 250, height: 120, fit: "fill" })
    .png()
    .toBuffer();

  const itemLines: Array<{ left: string; right?: string; muted?: boolean }> = [];
  for (const bundle of order.bundles || []) {
    const lines = wrap(`Bundle · ${bundle.name}`, 38);
    lines.forEach((line, index) => itemLines.push({
      left: line,
      right: index === lines.length - 1 ? formatMMK(bundle.price) : undefined,
      muted: index > 0,
    }));
  }
  for (const item of order.items) {
    const lines = wrap(`${item.name}  × ${item.quantity}`, 38);
    lines.forEach((line, index) => itemLines.push({
      left: line,
      right: index === lines.length - 1
        ? formatMMK(item.unitPrice * item.quantity)
        : undefined,
      muted: index > 0,
    }));
  }

  const addressLines = order.shippingAddress === "Secure digital handover"
    ? ["Secure digital handover"]
    : wrap(order.shippingAddress, 48);
  const payment = paymentDetails(order.paymentMethod);
  const height = Math.max(1420, 1160 + itemLines.length * 56 + addressLines.length * 42);
  let y = 400;
  const rows: string[] = [];
  const line = (label: string, value: string, options: { strong?: boolean; right?: boolean; size?: number; color?: string } = {}) => {
    const weight = options.strong ? 700 : 450;
    const anchor = options.right ? "end" : "start";
    const x = options.right ? WIDTH - LEFT : LEFT;
    rows.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" class="body" font-size="${options.size || 29}" font-weight="${weight}" fill="${options.color || "#20211f"}">${xml(label)}${value ? ` ${xml(value)}` : ""}</text>`);
    y += 46;
  };

  line("Customer", order.customerName, { strong: true });
  line("Phone", order.phone);
  line("Delivery", addressLines[0]);
  for (const continuation of addressLines.slice(1)) line("", continuation, { color: "#62645e" });
  y += 22;
  rows.push(`<line x1="${LEFT}" y1="${y}" x2="${WIDTH - LEFT}" y2="${y}" stroke="#ddd9cf" stroke-width="2"/>`);
  y += 58;
  line("ITEMS", "", { strong: true, size: 24, color: "#ff572c" });
  for (const item of itemLines) {
    const rowY = y;
    rows.push(`<text x="${LEFT}" y="${rowY}" class="body" font-size="28" font-weight="${item.muted ? 400 : 600}" fill="#20211f">${xml(item.left)}</text>`);
    if (item.right) rows.push(`<text x="${WIDTH - LEFT}" y="${rowY}" text-anchor="end" class="body" font-size="27" font-weight="650" fill="#20211f">${xml(item.right)}</text>`);
    y += 52;
  }
  y += 10;
  if (order.shippingFee > 0) {
    rows.push(`<text x="${LEFT}" y="${y}" class="body" font-size="27" fill="#62645e">Delivery fee</text><text x="${WIDTH - LEFT}" y="${y}" text-anchor="end" class="body" font-size="27" fill="#62645e">${xml(formatMMK(order.shippingFee))}</text>`);
    y += 54;
  }
  rows.push(`<rect x="${LEFT}" y="${y - 35}" width="${WIDTH - LEFT * 2}" height="88" rx="18" fill="#20211f"/>`);
  rows.push(`<text x="${LEFT + 28}" y="${y + 22}" class="body" font-size="30" font-weight="700" fill="#fff">TOTAL</text><text x="${WIDTH - LEFT - 28}" y="${y + 22}" text-anchor="end" class="body" font-size="32" font-weight="750" fill="#fff">${xml(formatMMK(order.totalAmount))}</text>`);
  y += 128;
  line("PAYMENT", "", { strong: true, size: 24, color: "#ff572c" });
  line(payment.label, "", { strong: true });
  line("Account name", payment.holder);
  line("Account number", payment.account, { strong: true });
  y += 18;
  rows.push(`<rect x="${LEFT}" y="${y}" width="${WIDTH - LEFT * 2}" height="150" rx="22" fill="#fff0e9"/>`);
  rows.push(`<text x="${LEFT + 28}" y="${y + 45}" class="body" font-size="25" font-weight="700" fill="#d8421e">PAYMENT SLIP</text>`);
  rows.push(`<text x="${LEFT + 28}" y="${y + 87}" class="body" font-size="25" fill="#3a3b37">ငွေလွှဲပြီးပါက Slip ပုံနှင့် Order Code ကို</text>`);
  rows.push(`<text x="${LEFT + 28}" y="${y + 124}" class="body" font-size="25" fill="#3a3b37">ဤ Telegram Bot သို့ ပေးပို့ပါခင်ဗျာ။</text>`);

  const svg = Buffer.from(`
    <svg width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .body {
          font-family: 'Noto Sans', 'Noto Sans Myanmar', sans-serif;
        }
      </style>
      <rect width="${WIDTH}" height="${height}" fill="#eceae3"/>
      <rect x="42" y="42" width="996" height="${height - 84}" rx="34" fill="#fffdf8"/>
      <rect x="42" y="42" width="996" height="18" rx="9" fill="#ff572c"/>
      <image href="data:image/png;base64,${logo.toString("base64")}" x="${LEFT}" y="92" width="250" height="120" preserveAspectRatio="xMidYMid meet"/>
      <text x="${WIDTH - LEFT}" y="136" text-anchor="end" class="body" font-size="24" font-weight="700" fill="#ff572c">SALES RECEIPT</text>
      <text x="${WIDTH - LEFT}" y="184" text-anchor="end" class="body" font-size="34" font-weight="750" fill="#20211f">${xml(order.orderCode)}</text>
      <text x="${LEFT}" y="286" class="body" font-size="42" font-weight="750" fill="#20211f">Thank you for your order</text>
      <text x="${LEFT}" y="334" class="body" font-size="25" fill="#62645e">${xml(clientConfig.receipt.storeName)} · ${xml(clientConfig.receipt.telegram)}</text>
      ${rows.join("\n")}
      <text x="${WIDTH / 2}" y="${height - 92}" text-anchor="middle" class="body" font-size="22" fill="#777971">Keep this receipt for payment and warranty reference.</text>
    </svg>`);

  return sharp(svg).png({ compressionLevel: 9 }).toBuffer();
}
