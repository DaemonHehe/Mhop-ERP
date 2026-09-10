import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import QRCode from "qrcode";
import {
  type CardTier,
  type CustomerTier,
  getCardTier,
} from "@/lib/loyalty";

export { getCardTier };

// Ensure Fontconfig can discover bundled fonts on Linux / Vercel
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

function xml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export interface MemberCardInput {
  customerName?: string | null;
  customerCode?: string | null;
  memberId?: string | null;
  phone?: string | null;
  tier?: CustomerTier | CardTier | string | null;
  points?: number | null;
  qrUrl?: string | null;
  sinceYear?: number | string | null;
}

interface TierTheme {
  title: string;
  subtitle: string;
  burmeseName: string;
  bgStops: Array<{ offset: string; color: string }>;
  accentColor: string;
  accentGradient: [string, string];
  foilColor: string;
  chipBase: [string, string];
  chipLines: string;
  borderGradient: [string, string];
  pillBg: string;
  pillBorder: string;
  perksText: string;
}

const TIER_THEMES: Record<CardTier, TierTheme> = {
  classic: {
    title: "CLASSIC",
    subtitle: "MH OP PRIVILEGE CLUB",
    burmeseName: "အသင်းဝင် (Classic)",
    bgStops: [
      { offset: "0%", color: "#070c18" },
      { offset: "35%", color: "#101d3b" },
      { offset: "70%", color: "#1a2c58" },
      { offset: "100%", color: "#091224" },
    ],
    accentColor: "#60a5fa",
    accentGradient: ["#93c5fd", "#ffffff"],
    foilColor: "#ffffff",
    chipBase: ["#f59e0b", "#d97706"],
    chipLines: "#b45309",
    borderGradient: ["rgba(147, 197, 253, 0.45)", "rgba(59, 130, 246, 0.15)"],
    pillBg: "rgba(10, 19, 40, 0.65)",
    pillBorder: "rgba(147, 197, 253, 0.35)",
    perksText: "EARN 1 PT PER 1,000 MMK SPENT",
  },
  silver: {
    title: "SILVER",
    subtitle: "MH OP VIP PRIVILEGE",
    burmeseName: "ငွေအဆင့် VIP (Silver)",
    bgStops: [
      { offset: "0%", color: "#28303d" },
      { offset: "30%", color: "#48566a" },
      { offset: "65%", color: "#687a94" },
      { offset: "100%", color: "#323d4e" },
    ],
    accentColor: "#e2e8f0",
    accentGradient: ["#f8fafc", "#cbd5e1"],
    foilColor: "#f8fafc",
    chipBase: ["#cbd5e1", "#94a3b8"],
    chipLines: "#64748b",
    borderGradient: ["rgba(255, 255, 255, 0.55)", "rgba(148, 163, 184, 0.2)"],
    pillBg: "rgba(30, 41, 59, 0.7)",
    pillBorder: "rgba(226, 232, 240, 0.4)",
    perksText: "FREE DELIVERY ACROSS MYANMAR",
  },
  gold: {
    title: "GOLD",
    subtitle: "MH OP VIP PRIVILEGE",
    burmeseName: "ရွှေအဆင့် VIP (Gold)",
    bgStops: [
      { offset: "0%", color: "#452e07" },
      { offset: "25%", color: "#8a6113" },
      { offset: "55%", color: "#c99c31" },
      { offset: "80%", color: "#774e0d" },
      { offset: "100%", color: "#a87a1e" },
    ],
    accentColor: "#fef08a",
    accentGradient: ["#fef08a", "#ffffff"],
    foilColor: "#fef9c3",
    chipBase: ["#fde047", "#ca8a04"],
    chipLines: "#a16207",
    borderGradient: ["rgba(254, 240, 138, 0.7)", "rgba(202, 138, 4, 0.3)"],
    pillBg: "rgba(50, 32, 5, 0.72)",
    pillBorder: "rgba(253, 224, 71, 0.5)",
    perksText: "FREE DELIVERY + 5% VIP DISCOUNT",
  },
  platinum: {
    title: "PLATINUM",
    subtitle: "MH OP ELITE VIP",
    burmeseName: "ပလက်တီနမ် VIP (Platinum)",
    bgStops: [
      { offset: "0%", color: "#0f141d" },
      { offset: "35%", color: "#1e2738" },
      { offset: "70%", color: "#323f54" },
      { offset: "100%", color: "#141a24" },
    ],
    accentColor: "#cbd5e1",
    accentGradient: ["#ffffff", "#94a3b8"],
    foilColor: "#f1f5f9",
    chipBase: ["#e2e8f0", "#94a3b8"],
    chipLines: "#475569",
    borderGradient: ["rgba(241, 245, 249, 0.5)", "rgba(148, 163, 184, 0.2)"],
    pillBg: "rgba(15, 23, 42, 0.75)",
    pillBorder: "rgba(203, 213, 225, 0.4)",
    perksText: "FREE DELIVERY + 10% VIP DISCOUNT",
  },
  diamond: {
    title: "DIAMOND",
    subtitle: "MH OP LIMITLESS VIP",
    burmeseName: "ဒိုင်းမွန်း VIP (Diamond)",
    bgStops: [
      { offset: "0%", color: "#1a2333" },
      { offset: "30%", color: "#334155" },
      { offset: "65%", color: "#64748b" },
      { offset: "100%", color: "#1e293b" },
    ],
    accentColor: "#67e8f9",
    accentGradient: ["#a5f3fc", "#ffffff"],
    foilColor: "#ffffff",
    chipBase: ["#e0f2fe", "#7dd3fc"],
    chipLines: "#0284c7",
    borderGradient: ["rgba(165, 243, 252, 0.65)", "rgba(56, 189, 248, 0.25)"],
    pillBg: "rgba(15, 23, 42, 0.8)",
    pillBorder: "rgba(103, 232, 249, 0.45)",
    perksText: "FREE DELIVERY + 15% VIP DISCOUNT",
  },
};

/**
 * Format 16-character credit card style display number:
 * e.g. "MH • 8912 • 4082 • 9104"
 */
export function formatCardNumber(rawId?: string | null): string {
  if (!rawId) return "MH • 7720 • 9104 • 8821";
  const clean = rawId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (clean.length < 8) {
    const padded = clean.padEnd(8, "0");
    return `MH • ${padded.slice(0, 4)} • ${padded.slice(4, 8)} • 0001`;
  }
  const chunk1 = clean.slice(-12, -8) || "8820";
  const chunk2 = clean.slice(-8, -4) || "4102";
  const chunk3 = clean.slice(-4) || "9918";
  return `MH • ${chunk1} • ${chunk2} • ${chunk3}`;
}

/**
 * Renders a high-resolution, luxury tiered VIP Membership Card (1000 × 630 px)
 * matching the aesthetic of the reference card designs.
 */
export async function renderMemberCardImage(
  input: MemberCardInput = {},
): Promise<Buffer> {
  const points = Math.max(0, Math.floor(input.points || 0));
  const visualTier = getCardTier(input.tier, points);
  const theme = TIER_THEMES[visualTier];

  const rawName = (input.customerName || "").trim();
  const displayName = (rawName || "VALUED VIP MEMBER")
    .toUpperCase()
    .slice(0, 28);

  const cardNumber = formatCardNumber(input.memberId || input.customerCode || input.phone);
  const since = input.sinceYear || "2025";

  // App URL for QR code
  const appBaseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://mhop-erp-daemon.vercel.app"
  ).replace(/\/+$/, "");
  const targetQrUrl = input.qrUrl || `${appBaseUrl}/shop`;

  let qrSvg = "";
  try {
    const rawQr = await QRCode.toString(targetQrUrl, {
      type: "svg",
      width: 72,
      margin: 0,
      color: {
        dark: theme.title === "GOLD" ? "#452e07" : "#0f172a",
        light: "#ffffff",
      },
    });
    const match = rawQr.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
    qrSvg = match ? match[1] : "";
  } catch {
    // fallback if QR generation fails
    qrSvg = `<rect width="72" height="72" fill="#ffffff" rx="8"/><circle cx="36" cy="36" r="24" fill="#0f172a"/>`;
  }

  // Official MH OP Monogram Paths from public/mhop-logo-transparent.svg
  const mhPath =
    "M 563.023 361.250 C 555.676 377.887, 545.754 400.275, 540.976 411 C 536.198 421.725, 529.118 437.700, 525.243 446.500 C 515.818 467.901, 484.478 538.472, 473.061 564 C 468.018 575.275, 463.467 584.927, 462.946 585.450 C 462.351 586.047, 462 579.573, 462 568 C 462 556.844, 461.640 549.974, 461.085 550.550 C 460.581 551.073, 456.354 560.050, 451.690 570.500 C 447.026 580.950, 434.557 608.850, 423.980 632.500 C 398.595 689.263, 398 690.622, 398 691.900 C 398 692.647, 402.470 693, 411.933 693 C 425.504 693, 425.884 692.942, 426.576 690.750 C 426.966 689.513, 433.122 675.450, 440.256 659.500 C 447.390 643.550, 456.511 623.075, 460.526 614 C 464.540 604.925, 472.407 587.375, 478.007 575 C 483.606 562.625, 489.106 550.362, 490.227 547.750 L 492.267 543 L 501.430 543 L 510.593 543 516.462 529.750 C 519.690 522.462, 525.341 509.750, 529.019 501.500 C 532.697 493.250, 539.317 478.400, 543.731 468.500 C 548.144 458.600, 555.692 441.725, 560.504 431 C 565.316 420.275, 572.743 403.625, 577.009 394 C 581.275 384.375, 589.093 366.845, 594.383 355.045 C 599.672 343.244, 604 333.007, 604 332.295 C 604 331.298, 600.826 331, 590.191 331 L 576.383 331 563.023 361.250 M 158 512 L 158 612 L 172 612 L 186 612 L 186 534.500 C 186 486.256, 186.358 457, 186.949 457 C 187.472 457, 193.309 463.637, 199.922 471.750 C 222.784 499.797, 232.692 511.849, 238.584 518.780 C 241.838 522.607, 248.283 530.311, 252.906 535.900 C 257.529 541.490, 261.630 545.936, 262.020 545.781 C 262.879 545.440, 274.422 531.633, 322.500 473.444 L 336.500 456.500 336.756 534.250 L 337.012 612 350.996 612 L 364.979 612 365.239 568.750 L 365.500 525.500 414.250 525.240 L 463 524.981 463.088 533.740 L 463.176 542.500 468.043 532.500 C 470.719 527, 474.471 518.900, 476.379 514.500 C 478.288 510.100, 482.358 500.959, 485.424 494.187 L 491 481.874 491 446.937 L 491 412 477.011 412 L 463.021 412 462.761 454.750 L 462.500 497.500 414.565 497.760 C 376.880 497.964, 366.459 497.750, 365.830 496.760 C 365.391 496.067, 365.024 476.712, 365.015 453.750 L 365 412 351.155 412 L 337.311 412 321.905 430.653 C 313.432 440.913, 300.875 456.116, 294 464.438 C 287.125 472.760, 277.280 484.841, 272.122 491.285 C 266.963 497.728, 262.379 503, 261.935 503 C 261.197 503, 251.984 492.074, 232 467.500 C 216.383 448.295, 191.550 418.373, 188.638 415.250 L 185.608 412 171.804 412 L 158 412 158 512";
  const opPath =
    "M 603.660 412.989 C 600.998 413.468, 595.787 414.781, 592.081 415.907 C 586.703 417.540, 585.079 418.514, 584.039 420.727 C 582.240 424.554, 571.506 448.798, 567.362 458.393 L 563.953 466.286 570.814 459.815 C 584.614 446.796, 598.179 440.999, 616.652 440.224 C 630.857 439.628, 639.855 441.529, 652.312 447.759 C 659.758 451.482, 663.136 453.988, 670.130 460.975 C 677.352 468.191, 679.508 471.139, 683.346 479.049 C 685.868 484.247, 688.652 491.622, 689.531 495.437 C 691.568 504.271, 691.583 519.675, 689.564 528.382 C 682.110 560.520, 652.743 584, 620 584 C 592.584 584, 567.600 567.922, 555.512 542.500 C 550.387 531.723, 548.715 523.158, 549.139 509.849 L 549.500 498.500 539.619 520.714 L 529.738 542.928 520.619 543.214 L 511.500 543.500 508.643 549.500 C 504.246 558.732, 445 691.792, 445 692.434 C 445 692.745, 451.495 693, 459.433 693 C 473.525 693, 473.882 692.947, 474.567 690.750 C 475.675 687.193, 531.123 561.596, 531.998 560.658 C 532.430 560.195, 534.906 563.120, 537.499 567.158 C 543.933 577.177, 559.538 592.264, 569.793 598.380 C 579.238 604.013, 594.195 609.411, 605 611.087 C 616.592 612.884, 635.599 611.731, 646.277 608.582 C 669.631 601.694, 690.046 586.504, 702.924 566.433 C 706.213 561.307, 713.849 544.804, 724.507 519.790 L 741 481.080 741 460.493 L 741 439.906 776.750 440.203 C 812.401 440.499, 812.514 440.507, 817.500 442.955 C 831.841 449.997, 839.872 466.160, 836.974 482.144 C 834.887 493.653, 828.140 502.819, 818.142 507.730 L 812.500 510.500 779.179 511 L 745.857 511.500 729.440 549.500 L 713.022 587.500 713.011 599.750 L 713 612 727.250 612 L 741.500 612 741.500 575.750 L 741.500 539.500 778.500 538.997 L 815.500 538.494 823.500 535.706 C 860.048 522.969, 876.382 481.573, 858.874 446.058 C 851.809 431.725, 839.583 421.261, 822.275 414.731 C 816.660 412.612, 815.070 412.543, 764.764 412.226 L 713.028 411.900 712.764 443.700 L 712.500 475.500 709 468.009 C 697.271 442.906, 672.297 422.090, 645.198 414.829 C 636.578 412.520, 612.254 411.442, 603.660 412.989";

  const svg = `
  <svg width="1000" height="630" viewBox="0 0 1000 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Base Card Clipping -->
      <clipPath id="cardShape">
        <rect x="0" y="0" width="1000" height="630" rx="36" ry="36"/>
      </clipPath>

      <!-- Background Linear Gradient -->
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        ${theme.bgStops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join("\n")}
      </linearGradient>

      <!-- Ambient Light Radial Glow -->
      <radialGradient id="radialGlow" cx="80%" cy="20%" r="60%">
        <stop offset="0%" stop-color="${theme.accentColor}" stop-opacity="0.22"/>
        <stop offset="60%" stop-color="${theme.accentColor}" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="${theme.accentColor}" stop-opacity="0"/>
      </radialGradient>

      <!-- Secondary Soft Glow -->
      <radialGradient id="softGlow2" cx="20%" cy="85%" r="50%">
        <stop offset="0%" stop-color="${theme.accentColor}" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="${theme.accentColor}" stop-opacity="0"/>
      </radialGradient>

      <!-- Diagonal Glass Sheen -->
      <linearGradient id="sheen" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14"/>
        <stop offset="40%" stop-color="#ffffff" stop-opacity="0.04"/>
        <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>

      <!-- Metallic Foil Gradient for Typography -->
      <linearGradient id="foilGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${theme.accentGradient[0]}"/>
        <stop offset="50%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="${theme.accentGradient[1]}"/>
      </linearGradient>

      <!-- Card Edge Bevel Gradient -->
      <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.borderGradient[0]}"/>
        <stop offset="100%" stop-color="${theme.borderGradient[1]}"/>
      </linearGradient>

      <!-- EMV Chip Gradient -->
      <linearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.chipBase[0]}"/>
        <stop offset="100%" stop-color="${theme.chipBase[1]}"/>
      </linearGradient>

      <!-- Drop Shadow Filter -->
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.45"/>
      </filter>
      <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>

    <style>
      .card-title {
        font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 900;
        letter-spacing: 7px;
      }
      .card-subtitle {
        font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 700;
        letter-spacing: 3px;
      }
      .card-number {
        font-family: 'Noto Sans', monospace;
        font-weight: 700;
        letter-spacing: 5px;
      }
      .card-name {
        font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 800;
        letter-spacing: 2.5px;
      }
      .card-meta {
        font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 600;
        letter-spacing: 1.5px;
      }
      .card-points {
        font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 900;
        letter-spacing: 1px;
      }
    </style>

    <g clip-path="url(#cardShape)">
      <!-- 1. Background Layers -->
      <rect width="1000" height="630" fill="url(#bgGrad)"/>
      <rect width="1000" height="630" fill="url(#radialGlow)"/>
      <rect width="1000" height="630" fill="url(#softGlow2)"/>

      <!-- 2. Subtle Luxury Security Guilloche Lines -->
      <g stroke="${theme.accentColor}" stroke-opacity="0.06" stroke-width="1.2" fill="none">
        <circle cx="850" cy="180" r="140"/>
        <circle cx="850" cy="180" r="220"/>
        <circle cx="850" cy="180" r="300"/>
        <circle cx="850" cy="180" r="380"/>
        <circle cx="850" cy="180" r="460"/>
        <path d="M 0,200 Q 500,100 1000,280"/>
        <path d="M 0,280 Q 500,180 1000,360"/>
        <path d="M 0,360 Q 500,260 1000,440"/>
      </g>

      <!-- 3. Watermark Monogram (Subtle background brand seal) -->
      <g transform="translate(560, 90) scale(0.42)" opacity="0.07" fill="${theme.foilColor}">
        <path d="${mhPath}" fill-rule="evenodd"/>
        <path d="${opPath}" fill-rule="evenodd"/>
      </g>

      <!-- 4. Diagonal Glass Reflection Beam -->
      <polygon points="0,0 360,0 120,630 0,630" fill="url(#sheen)"/>

      <!-- 5. Top Header: Tier Title (Top-Left) -->
      <g transform="translate(68, 86)">
        <text x="0" y="0" class="card-title" font-size="34" fill="url(#foilGrad)" filter="url(#shadow)">
          ${theme.title}
        </text>
        <text x="0" y="24" class="card-subtitle" font-size="10" fill="${theme.accentColor}" fill-opacity="0.85">
          ${theme.subtitle}
        </text>
      </g>

      <!-- 6. Top Header: Brand Emblem & Monogram (Top-Right) -->
      <g transform="translate(740, 52)">
        <!-- Official Mini Monogram -->
        <g transform="translate(0, 0) scale(0.065)" fill="url(#foilGrad)">
          <path d="${mhPath}" fill-rule="evenodd"/>
          <path d="${opPath}" fill-rule="evenodd"/>
        </g>
        <!-- Brand Signature -->
        <text x="76" y="34" class="card-title" font-size="24" fill="url(#foilGrad)" letter-spacing="3">
          MH OP
        </text>
        <text x="76" y="50" class="card-subtitle" font-size="8.5" fill="${theme.accentColor}" fill-opacity="0.8" letter-spacing="3.5">
          LIMITLESS GAMING
        </text>
      </g>

      <!-- 7. EMV Smart Chip & Contactless NFC Waves -->
      <g transform="translate(68, 172)">
        <!-- Chip Body -->
        <rect x="0" y="0" width="86" height="66" rx="12" fill="url(#chipGrad)" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" filter="url(#shadow)"/>
        <!-- Chip Circuitry Lines -->
        <rect x="22" y="16" width="42" height="34" rx="4" fill="none" stroke="${theme.chipLines}" stroke-width="1.2"/>
        <line x1="0" y1="33" x2="22" y2="33" stroke="${theme.chipLines}" stroke-width="1.2"/>
        <line x1="64" y1="33" x2="86" y2="33" stroke="${theme.chipLines}" stroke-width="1.2"/>
        <line x1="43" y1="0" x2="43" y2="16" stroke="${theme.chipLines}" stroke-width="1.2"/>
        <line x1="43" y1="50" x2="43" y2="66" stroke="${theme.chipLines}" stroke-width="1.2"/>

        <!-- Contactless NFC Icon (Concentric Waves) -->
        <g transform="translate(112, 16)" stroke="${theme.accentColor}" stroke-opacity="0.75" stroke-width="2.2" stroke-linecap="round" fill="none">
          <path d="M 0,10 A 14,14 0 0,1 0,24"/>
          <path d="M 5,6 A 20,20 0 0,1 5,28"/>
          <path d="M 10,2 A 26,26 0 0,1 10,32"/>
        </g>
      </g>

      <!-- 8. Right Side: Available Points & Perks Box (Frosted Glass Container) -->
      <g transform="translate(560, 422)">
        <rect x="0" y="0" width="372" height="138" rx="22" fill="${theme.pillBg}" stroke="${theme.pillBorder}" stroke-width="1.5" filter="url(#shadow)"/>
        
        <!-- Points Header -->
        <text x="24" y="32" class="card-meta" font-size="10.5" fill="${theme.accentColor}" fill-opacity="0.85">
          AVAILABLE BALANCE
        </text>

        <!-- Dynamic Points Counter -->
        <text x="24" y="78" class="card-points" font-size="38" fill="url(#foilGrad)" filter="url(#shadow)">
          ${points.toLocaleString()} <tspan font-size="22" font-weight="700" fill="${theme.accentColor}">PTS</tspan>
        </text>

        <!-- Perks Tagline -->
        <rect x="24" y="96" width="324" height="26" rx="8" fill="rgba(255,255,255,0.08)"/>
        <text x="36" y="113" class="card-meta" font-size="9" font-weight="700" fill="#ffffff" letter-spacing="1.2">
          ✨ ${theme.perksText}
        </text>
      </g>

      <!-- 9. QR Code Verification Stamp (Discreetly nestled above points) -->
      <g transform="translate(856, 332)">
        <rect x="0" y="0" width="76" height="76" rx="14" fill="#ffffff" filter="url(#shadow)"/>
        <g transform="translate(2, 2)">
          ${qrSvg}
        </g>
      </g>

      <!-- 10. Card Number (Embossed Monospace Display) -->
      <g transform="translate(68, 385)">
        <text x="0" y="0" class="card-number" font-size="24" fill="url(#foilGrad)" filter="url(#shadow)">
          ${xml(cardNumber)}
        </text>
      </g>

      <!-- 11. Customer Name & Validity (Bottom-Left) -->
      <g transform="translate(68, 470)">
        <text x="0" y="0" class="card-meta" font-size="9" fill="${theme.accentColor}" fill-opacity="0.75">
          MEMBER NAME
        </text>
        <text x="0" y="32" class="card-name" font-size="25" fill="#ffffff" filter="url(#shadow)">
          ${xml(displayName)}
        </text>

        <!-- Status & Membership Year -->
        <g transform="translate(0, 64)">
          <text x="0" y="0" class="card-meta" font-size="10" fill="${theme.accentColor}" fill-opacity="0.85">
            STATUS: <tspan fill="#ffffff" font-weight="800">ACTIVE VIP</tspan> • VALID: <tspan fill="#ffffff" font-weight="800">NEVER EXPIRES</tspan> • SINCE ${xml(since)}
          </text>
        </g>
      </g>

      <!-- 12. Outer Metallic Bevel Edge -->
      <rect x="1.5" y="1.5" width="997" height="627" rx="35" fill="none" stroke="url(#borderGrad)" stroke-width="2.5"/>
    </g>
  </svg>
  `;

  return sharp(Buffer.from(svg))
    .png({ compressionLevel: 8 })
    .toBuffer();
}
