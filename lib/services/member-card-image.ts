import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
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
  bgStops: [string, string, string];
  accentColor: string;
  foilGrad: [string, string, string];
  borderGrad: [string, string];
  glowColor: string;
  perksText: string;
}

const TIER_THEMES: Record<CardTier, TierTheme> = {
  classic: {
    title: "CLASSIC",
    subtitle: "VIP PRIVILEGE",
    burmeseName: "အသင်းဝင် (Classic)",
    bgStops: ["#070d18", "#111e35", "#091020"],
    accentColor: "#93c5fd",
    foilGrad: ["#bfdbfe", "#ffffff", "#93c5fd"],
    borderGrad: ["rgba(147, 197, 253, 0.65)", "rgba(59, 130, 246, 0.25)"],
    glowColor: "#3b82f6",
    perksText: "EARN 1 PT / 1,000 MMK",
  },
  silver: {
    title: "SILVER",
    subtitle: "VIP PRIVILEGE",
    burmeseName: "ငွေအဆင့် VIP (Silver)",
    bgStops: ["#0e131b", "#1e2634", "#101520"],
    accentColor: "#e2e8f0",
    foilGrad: ["#ffffff", "#e2e8f0", "#94a3b8"],
    borderGrad: ["rgba(255, 255, 255, 0.75)", "rgba(148, 163, 184, 0.3)"],
    glowColor: "#94a3b8",
    perksText: "FREE DELIVERY ACROSS MYANMAR",
  },
  gold: {
    title: "GOLD",
    subtitle: "ELITE VIP PRIVILEGE",
    burmeseName: "ရွှေအဆင့် VIP (Gold)",
    bgStops: ["#150f05", "#2c1e09", "#181105"],
    accentColor: "#fef08a",
    foilGrad: ["#fef08a", "#ffffff", "#eab308"],
    borderGrad: ["rgba(254, 240, 138, 0.85)", "rgba(234, 179, 8, 0.35)"],
    glowColor: "#eab308",
    perksText: "FREE DELIVERY + 5% DISCOUNT",
  },
  platinum: {
    title: "PLATINUM",
    subtitle: "ROYAL VIP PRIVILEGE",
    burmeseName: "ပလက်တီနမ် VIP (Platinum)",
    bgStops: ["#07090e", "#131924", "#090c13"],
    accentColor: "#cbd5e1",
    foilGrad: ["#ffffff", "#e2e8f0", "#7dd3fc"],
    borderGrad: ["rgba(255, 255, 255, 0.85)", "rgba(56, 189, 248, 0.4)"],
    glowColor: "#38bdf8",
    perksText: "FREE DELIVERY + 10% DISCOUNT",
  },
};

/**
 * Format credit card style display number without duplicate prefixes:
 * e.g. "MH • CUST • 6365 • 2025" or "MH • 7720 • 9104 • 8821"
 */
export function formatCardNumber(rawId?: string | null): string {
  if (!rawId) return "MH • 7720 • 9104 • 8821";
  const clean = rawId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const body = clean.replace(/^MH/, "");

  const custMatch = body.match(/^CUST(\d{1,8})$/);
  if (custMatch) {
    return `MH • CUST • ${custMatch[1].padStart(4, "0")} • 2025`;
  }

  if (body.length < 8) {
    const padded = body.padEnd(8, "0");
    return `MH • ${padded.slice(0, 4)} • ${padded.slice(4, 8)} • 0001`;
  }

  const chunk1 = body.slice(-12, -8) || "8820";
  const chunk2 = body.slice(-8, -4) || "4102";
  const chunk3 = body.slice(-4) || "9918";
  return `MH • ${chunk1} • ${chunk2} • ${chunk3}`;
}

/**
 * Extract 4-digit card number for prominent display (e.g. "1234" from "MH-CUST-1234" or phone):
 */
export function extractShortCode(rawId?: string | null): string {
  if (!rawId) return "1234";
  const clean = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const numMatch = clean.match(/(\d{4})$/);
  if (numMatch) return numMatch[1];
  const anyNums = clean.match(/\d+/g)?.join("") || "";
  if (anyNums.length >= 4) return anyNums.slice(-4);
  if (anyNums.length > 0) return anyNums.padStart(4, "0");
  return "1234";
}

let cachedWarriorUri: string | null = null;
function getWarriorDataUri(): string {
  if (cachedWarriorUri) return cachedWarriorUri;
  const candidatePaths = [
    path.join(process.cwd(), "assets", "images", "taksin-lineart.png"),
    path.join(process.cwd(), "public", "images", "taksin-lineart.png"),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      cachedWarriorUri = `data:image/png;base64,${buf.toString("base64")}`;
      return cachedWarriorUri;
    }
  }
  return "";
}

/**
 * Renders a high-resolution, luxury tiered VIP Membership Card (1000 × 630 px)
 * featuring the iconic King Taksin warrior on horseback with dynamic lighting,
 * official brand wordmarks, and prominent member digits matching user design.
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
    .slice(0, 26);

  const rawIdentifier = input.customerCode || input.memberId || input.phone;
  const cardNumber = formatCardNumber(rawIdentifier);
  const shortCode = extractShortCode(rawIdentifier);
  const since = input.sinceYear || "2025";
  const warriorUri = getWarriorDataUri();

  // Official MH OP Monogram Paths from public/mhop-logo-transparent.svg
  const mhPath =
    "M 563.023 361.250 C 555.676 377.887, 545.754 400.275, 540.976 411 C 536.198 421.725, 529.118 437.700, 525.243 446.500 C 515.818 467.901, 484.478 538.472, 473.061 564 C 468.018 575.275, 463.467 584.927, 462.946 585.450 C 462.351 586.047, 462 579.573, 462 568 C 462 556.844, 461.640 549.974, 461.085 550.550 C 460.581 551.073, 456.354 560.050, 451.690 570.500 C 447.026 580.950, 434.557 608.850, 423.980 632.500 C 398.595 689.263, 398 690.622, 398 691.900 C 398 692.647, 402.470 693, 411.933 693 C 425.504 693, 425.884 692.942, 426.576 690.750 C 426.966 689.513, 433.122 675.450, 440.256 659.500 C 447.390 643.550, 456.511 623.075, 460.526 614 C 464.540 604.925, 472.407 587.375, 478.007 575 C 483.606 562.625, 489.106 550.362, 490.227 547.750 L 492.267 543 L 501.430 543 L 510.593 543 516.462 529.750 C 519.690 522.462, 525.341 509.750, 529.019 501.500 C 532.697 493.250, 539.317 478.400, 543.731 468.500 C 548.144 458.600, 555.692 441.725, 560.504 431 C 565.316 420.275, 572.743 403.625, 577.009 394 C 581.275 384.375, 589.093 366.845, 594.383 355.045 C 599.672 343.244, 604 333.007, 604 332.295 C 604 331.298, 600.826 331, 590.191 331 L 576.383 331 563.023 361.250 M 158 512 L 158 612 L 172 612 L 186 612 L 186 534.500 C 186 486.256, 186.358 457, 186.949 457 C 187.472 457, 193.309 463.637, 199.922 471.750 C 222.784 499.797, 232.692 511.849, 238.584 518.780 C 241.838 522.607, 248.283 530.311, 252.906 535.900 C 257.529 541.490, 261.630 545.936, 262.020 545.781 C 262.879 545.440, 274.422 531.633, 322.500 473.444 L 336.500 456.500 336.756 534.250 L 337.012 612 350.996 612 L 364.979 612 365.239 568.750 L 365.500 525.500 414.250 525.240 L 463 524.981 463.088 533.740 L 463.176 542.500 468.043 532.500 C 470.719 527, 474.471 518.900, 476.379 514.500 C 478.288 510.100, 482.358 500.959, 485.424 494.187 L 491 481.874 491 446.937 L 491 412 L 477.011 412 L 463.021 412 462.761 454.750 L 462.500 497.500 414.565 497.760 C 376.880 497.964, 366.459 497.750, 365.830 496.760 C 365.391 496.067, 365.024 476.712, 365.015 453.750 L 365 412 L 351.155 412 L 337.311 412 321.905 430.653 C 313.432 440.913, 300.875 456.116, 294 464.438 C 287.125 472.760, 277.280 484.841, 272.122 491.285 C 266.963 497.728, 262.379 503, 261.935 503 C 261.197 503, 251.984 492.074, 232 467.500 C 216.383 448.295, 191.550 418.373, 188.638 415.250 L 185.608 412 171.804 412 L 158 412 158 512";
  const opPath =
    "M 603.660 412.989 C 600.998 413.468, 595.787 414.781, 592.081 415.907 C 586.703 417.540, 585.079 418.514, 584.039 420.727 C 582.240 424.554, 571.506 448.798, 567.362 458.393 L 563.953 466.286 570.814 459.815 C 584.614 446.796, 598.179 440.999, 616.652 440.224 C 630.857 439.628, 639.855 441.529, 652.312 447.759 C 659.758 451.482, 663.136 453.988, 670.130 460.975 C 677.352 468.191, 679.508 471.139, 683.346 479.049 C 685.868 484.247, 688.652 491.622, 689.531 495.437 C 691.568 504.271, 691.583 519.675, 689.564 528.382 C 682.110 560.520, 652.743 584, 620 584 C 592.584 584, 567.600 567.922, 555.512 542.500 C 550.387 531.723, 548.715 523.158, 549.139 509.849 L 549.500 498.500 539.619 520.714 L 529.738 542.928 520.619 543.214 L 511.500 543.500 508.643 549.500 C 504.246 558.732, 445 691.792, 445 692.434 C 445 692.745, 451.495 693, 459.433 693 C 473.525 693, 473.882 692.947, 474.567 690.750 C 475.675 687.193, 531.123 561.596, 531.998 560.658 C 532.430 560.195, 534.906 563.120, 537.499 567.158 C 543.933 577.177, 559.538 592.264, 569.793 598.380 C 579.238 604.013, 594.195 609.411, 605 611.087 C 616.592 612.884, 635.599 611.731, 646.277 608.582 C 669.631 601.694, 690.046 586.504, 702.924 566.433 C 706.213 561.307, 713.849 544.804, 724.507 519.790 L 741 481.080 741 460.493 L 741 439.906 776.750 440.203 C 812.401 440.499, 812.514 440.507, 817.500 442.955 C 831.841 449.997, 839.872 466.160, 836.974 482.144 C 834.887 493.653, 828.140 502.819, 818.142 507.730 L 812.500 510.500 779.179 511 L 745.857 511.500 729.440 549.500 L 713.022 587.500 713.011 599.750 L 713 612 727.250 612 L 741.500 612 741.500 575.750 L 741.500 539.500 778.500 538.997 L 815.500 538.494 823.500 535.706 C 860.048 522.969, 876.382 481.573, 858.874 446.058 C 851.809 431.725, 839.583 421.261, 822.275 414.731 C 816.660 412.612, 815.070 412.543, 764.764 412.226 L 713.028 411.900 712.764 443.700 L 712.500 475.500 709 468.009 C 697.271 442.906, 672.297 422.090, 645.198 414.829 C 636.578 412.520, 612.254 411.442, 603.660 412.989";

  const svg = `
  <svg width="1000" height="630" viewBox="0 0 1000 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Base Card Shape Clipping -->
      <clipPath id="cardClip">
        <rect width="1000" height="630" rx="36" ry="36"/>
      </clipPath>

      <!-- Background Linear Gradient -->
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.bgStops[0]}"/>
        <stop offset="50%" stop-color="${theme.bgStops[1]}"/>
        <stop offset="100%" stop-color="${theme.bgStops[2]}"/>
      </linearGradient>

      <!-- Vertical Foil Gradient for Engraved Line Art -->
      <linearGradient id="foilVertical" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${theme.foilGrad[0]}"/>
        <stop offset="50%" stop-color="${theme.foilGrad[1]}"/>
        <stop offset="100%" stop-color="${theme.foilGrad[2]}"/>
      </linearGradient>

      <!-- Metallic Foil Gradient for Typography -->
      <linearGradient id="foilGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${theme.foilGrad[0]}"/>
        <stop offset="50%" stop-color="${theme.foilGrad[1]}"/>
        <stop offset="100%" stop-color="${theme.foilGrad[2]}"/>
      </linearGradient>

      <!-- Card Edge Bevel Gradient -->
      <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.borderGrad[0]}"/>
        <stop offset="100%" stop-color="${theme.borderGrad[1]}"/>
      </linearGradient>

      <!-- Atmospheric Ambient Aura -->
      <radialGradient id="centerAura" cx="50%" cy="45%" r="48%">
        <stop offset="0%" stop-color="${theme.glowColor}" stop-opacity="0.18"/>
        <stop offset="60%" stop-color="${theme.glowColor}" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="${theme.glowColor}" stop-opacity="0"/>
      </radialGradient>

      <!-- Mask to apply metallic foil directly onto the vector line art -->
      <mask id="warriorLineMask">
        <image href="${warriorUri}" x="220" y="10" width="560" height="590" preserveAspectRatio="xMidYMid meet"/>
      </mask>

      <!-- Drop Shadow Filter -->
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.9"/>
      </filter>
      <!-- Subtle Foil Bloom Filter -->
      <filter id="foilGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <style>
      .brand-title {
        font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 900;
        letter-spacing: 5px;
      }
      .brand-sub {
        font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 700;
        letter-spacing: 2.2px;
      }
      .tier-title {
        font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 900;
        letter-spacing: 6px;
      }
      .card-digits {
        font-family: 'Noto Sans', monospace;
        font-weight: 900;
        letter-spacing: 8px;
      }
      .card-name {
        font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 800;
        letter-spacing: 2px;
      }
      .card-meta {
        font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 700;
        letter-spacing: 1.8px;
      }
    </style>

    <!-- 1. Card Base Surface -->
    <rect width="1000" height="630" rx="36" fill="url(#bgGrad)"/>

    <!-- 2. Internal Card Elements (Clipped inside rounded card boundary) -->
    <g clip-path="url(#cardClip)">
      <!-- Atmospheric Ambient Lighting -->
      <rect width="1000" height="630" fill="url(#centerAura)"/>

      <!-- Subtle Luxury Guilloche Concentric Texture Rings -->
      <circle cx="500" cy="305" r="280" fill="none" stroke="${theme.glowColor}" stroke-opacity="0.08" stroke-width="1"/>
      <circle cx="500" cy="305" r="230" fill="none" stroke="${theme.glowColor}" stroke-opacity="0.06" stroke-width="1" stroke-dasharray="6,4"/>
      <circle cx="500" cy="305" r="180" fill="none" stroke="${theme.glowColor}" stroke-opacity="0.05" stroke-width="1"/>

      <!-- HERO CENTER: Pure Vector Line Art of King Taksin on Rearing Horse (NO photo background!) -->
      ${
        warriorUri
          ? `<rect x="220" y="10" width="560" height="590" fill="url(#foilVertical)" mask="url(#warriorLineMask)" filter="url(#foilGlow)"/>`
          : ""
      }

      <!-- 3. Top Header Left: MH OP Brand Emblem & Wordmark -->
      <g transform="translate(64, 52)">
        <g transform="translate(0, 3) scale(0.046)" fill="url(#foilGrad)" filter="url(#shadow)">
          <path d="${mhPath}" fill-rule="evenodd"/>
          <path d="${opPath}" fill-rule="evenodd"/>
        </g>
        <text x="58" y="26" class="brand-title" font-size="25" fill="url(#foilGrad)" filter="url(#shadow)">
          MH OP
        </text>
        <text x="58" y="42" class="brand-sub" font-size="9" fill="${theme.accentColor}" fill-opacity="0.85">
          VIP PRIVILEGE CLUB
        </text>
      </g>

      <!-- 4. Top Header Right: Card Tier Designation -->
      <g transform="translate(936, 52)" text-anchor="end">
        <text x="0" y="26" class="tier-title" font-size="26" fill="url(#foilGrad)" filter="url(#shadow)">
          ${xml(theme.title)}
        </text>
        <text x="0" y="42" class="brand-sub" font-size="9" fill="${theme.accentColor}" fill-opacity="0.85">
          ${xml(theme.subtitle)}
        </text>
      </g>

      <!-- 5. Bottom-Left: Member Details & Perks -->
      <g transform="translate(64, 510)">
        <text x="0" y="0" class="card-meta" font-size="8.5" fill="${theme.accentColor}" fill-opacity="0.8">
          CARDHOLDER
        </text>
        <text x="0" y="32" class="card-name" font-size="24" fill="#ffffff" filter="url(#shadow)">
          ${xml(displayName)}
        </text>
        <text x="0" y="58" class="card-meta" font-size="9" fill="${theme.accentColor}" fill-opacity="0.85">
          ${points.toLocaleString()} PTS · ${xml(theme.perksText)}
        </text>
        <text x="0" y="76" class="card-meta" font-size="8" fill="#ffffff" fill-opacity="0.6">
          STATUS: ACTIVE VIP · SINCE ${xml(since)}
        </text>
      </g>

      <!-- 6. Bottom-Right: 4-Digit Member ID (as drawn in user sketch: "1234") -->
      <g transform="translate(936, 508)" text-anchor="end">
        <text x="0" y="0" class="card-meta" font-size="8.5" fill="${theme.accentColor}" fill-opacity="0.8">
          MEMBER NUMBER
        </text>
        <text x="0" y="46" class="card-digits" font-size="48" fill="url(#foilGrad)" filter="url(#shadow)">
          ${xml(shortCode)}
        </text>
        <text x="0" y="70" class="card-meta" font-size="8.5" fill="${theme.accentColor}" fill-opacity="0.75" letter-spacing="3">
          ${xml(cardNumber)}
        </text>
      </g>
    </g>

    <!-- 7. Outer Precision Metallic Bevel Border -->
    <rect x="1.5" y="1.5" width="997" height="627" rx="34.5" fill="none" stroke="url(#borderGrad)" stroke-width="1.8"/>
  </svg>
  `;

  return sharp(Buffer.from(svg))
    .png({ compressionLevel: 8 })
    .toBuffer();
}
