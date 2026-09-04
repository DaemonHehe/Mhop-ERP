"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { InventoryItem } from "@/app/actions/store";
import { clientConfig } from "@/lib/client-config";

const control = "h-11 w-full rounded-xl border bg-white px-3 text-sm";
const campaigns = {
  "Product hero": {
    objective:
      "Create a premium hero advertisement that makes the product immediately desirable and trustworthy.",
    scene:
      "A refined studio product stage with tactile materials, subtle depth, and generous negative space.",
    lighting:
      "Soft commercial key light, controlled rim light, clean realistic reflections.",
  },
  "Social sale": {
    objective:
      "Create a high-converting promotional visual for a limited-time mobile-gaming sale.",
    scene:
      "An energetic layered campaign composition with a strong promotion and price safe zone.",
    lighting:
      "Punchy commercial lighting with crisp highlights and a controlled accent glow.",
  },
  "Feature spotlight": {
    objective:
      "Explain one product benefit visually while keeping the exact product dominant.",
    scene:
      "A minimal technical showcase with one supporting visual metaphor for the selected feature.",
    lighting:
      "Precise studio lighting that reveals materials, construction, and visible controls.",
  },
  "Launch announcement": {
    objective:
      "Introduce the product as a fresh, highly anticipated addition to the MH OP catalog.",
    scene:
      "A reveal-stage composition with confident scale, visual momentum, and launch-copy safe areas.",
    lighting:
      "A focused reveal light with premium edge separation and believable environmental reflections.",
  },
} as const;

const shortcuts = {
  "/productphoto":
    "High-end commercial product photography, immaculate studio finish, accurate materials, crisp edges, realistic contact shadow, premium catalog polish.",
  "/advertising":
    "Conversion-focused advertising key visual with an immediate focal point, persuasive hierarchy, campaign energy, and deliberate copy-safe areas.",
  "/luxury":
    "Quiet luxury aesthetic using refined materials, restrained highlights, rich dark neutrals, elegant spacing, and premium editorial restraint.",
  "/editorial":
    "Magazine-quality commercial art direction with refined composition, premium pacing, confident negative space, and sophisticated product storytelling.",
  "/brandingmockup":
    "Brand-campaign mockup with coordinated color, graphic devices, logo-safe placement, typography zones, and consistent MH OP visual identity.",
  "/posterdesign":
    "Bold poster composition with graphic rhythm, clear headline hierarchy, layered depth, and strong mobile-feed readability.",
  "/packaging":
    "Premium retail launch composition featuring the supplied product and only packaging visible in the reference; never invent box claims or accessories.",
  "/minimal":
    "Minimalist advertising with generous negative space, disciplined geometry, soft tactile surfaces, and one unmistakable focal point.",
  "/lifestyle":
    "A believable aspirational mobile-gaming lifestyle setting with human context that supports—but never obscures or alters—the product.",
  "/cinematicphoto":
    "Movie-grade product cinematography with intentional framing, atmospheric depth, realistic optics, controlled color science, and narrative tension.",
  "/dramaticlighting":
    "Strong cinematic key-to-fill contrast, sculpted shadows, bold edge separation, and a premium product reveal without losing surface detail.",
  "/rimlight":
    "Precise luminous rim lighting that defines the silhouette and materials while retaining a clean, realistic commercial key light.",
  "/backlit":
    "Commercial backlighting with a controlled luminous outline, translucent-material detail, atmospheric separation, and retained front-surface readability.",
  "/bokeh":
    "Premium shallow depth of field with tasteful optical bokeh behind the product, sharp product detail, and natural lens behavior.",
  "/depthoffield":
    "Controlled shallow depth of field that isolates the product while keeping its complete selling silhouette and essential details tack sharp.",
  "/macrophoto":
    "Extreme close-up commercial detail shot for materials, controls, texture, or craftsmanship, using realistic macro optics and precise focus.",
  "/topdown":
    "Top-down flat-lay composition with precise spacing, realistic scale, strong graphic balance, and carefully controlled supporting props.",
  "/lowangle":
    "Confident low-angle hero perspective that increases presence without distorting the product geometry or proportions.",
  "/wideangle":
    "Wide-angle environmental product composition that shows context and energy while controlling edge distortion and preserving accurate geometry.",
  "/telephoto":
    "Telephoto-style compression with elegant background layering, minimal perspective distortion, and premium subject isolation.",
  "/3drender":
    "Photorealistic CGI-style staging with physically based materials and lighting while preserving the attached real product rather than redesigning it.",
  "/hyperrealistic":
    "Extremely realistic product rendering with microscopic material detail, accurate reflections, natural imperfections, and physically plausible light.",
} as const;

type Campaign = keyof typeof campaigns;
type Shortcut = keyof typeof shortcuts;

export function AiCreativeStudio({ products }: { products: InventoryItem[] }) {
  const [productId, setProductId] = useState(products[0]?.variantId || "");
  const [campaign, setCampaign] = useState<Campaign>("Product hero");
  const [shortcut, setShortcut] = useState<Shortcut>("/advertising");
  const [platform, setPlatform] = useState("Facebook / Telegram");
  const [ratio, setRatio] = useState("1:1 square");
  const [audience, setAudience] = useState("Myanmar mobile gamers aged 18-35");
  const [headline, setHeadline] = useState("Hear every move.");
  const [offer, setOffer] = useState(
    "100% authentic, official store-direct product",
  );
  const [cta, setCta] = useState("Order now from MH OP");
  const [typography, setTypography] = useState(
    "Leave clean text-safe areas; add final copy later",
  );
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const product = products.find((item) => item.variantId === productId);
  const template = campaigns[campaign];
  const hasCatalogImage = Boolean(
    product && product.image !== "/placeholder.svg",
  );

  const prompt = useMemo(() => {
    if (!product) return "Select a product to build a prompt.";
    const referenceInstruction = hasCatalogImage
      ? "The same official product image shown in the MH OP Products & Stock listing will be attached with this prompt. Treat the attached image as the immutable source of truth."
      : "IMPORTANT: The catalog listing does not yet have a real product image. Add one in Products & Stock, then attach that image with this prompt before generating.";
    const textInstruction = typography.startsWith("Render")
      ? `Render only this exact copy, with correct spelling and no other text: headline “${headline}”; supporting line “${offer}”; CTA “${cta}”. Use a bold modern sans-serif hierarchy that remains readable on mobile.`
      : `Do not render final typography. Reserve intentional, uncluttered safe areas for headline “${headline}”, supporting line “${offer}”, and CTA “${cta}” so the admin can add them later in Canva or Figma.`;

    return `MASTER COMMERCIAL IMAGE PROMPT

REFERENCE IMAGE — REQUIRED
${referenceInstruction}
Use the attached photo as Image 1. Isolate and preserve the actual product from Image 1, then build a new advertising environment around it. This is an image-to-image advertising transformation, not a product redesign.

ROLE & OUTCOME
Act as a senior commercial art director, product photographer, and advertising designer. Create one eye-catching, conversion-focused campaign image for ${clientConfig.brand.fullName} (${clientConfig.brand.name}) that looks intentionally art-directed—not like a generic AI template.

PRODUCT IDENTITY — LOCKED
Product: ${product.brand} ${product.name}
SKU: ${product.sku}
Catalog context: ${product.category} / ${product.subcategory}; ${product.condition}; color or region: ${product.color || "match Image 1"}.
Known description: ${product.description || product.tagline}.
Preserve exactly from Image 1: silhouette, proportions, camera-visible geometry, materials, surface finish, colors, cables, ear tips, controls, seams, vents, printed marks, and the genuine logo already printed on the product. Preserve the number and placement of every visible component.
Never add, remove, duplicate, reshape, recolor, relabel, or “improve” the product. Never invent accessories, ports, buttons, packaging, specifications, certification marks, or features not visible in Image 1 or stated above. If any detail is hidden, keep it hidden instead of guessing.

MH OP CREATIVE SHORTCUT
Selected internal shortcut: ${shortcut}
Translate it into this visual direction: ${shortcuts[shortcut]}
The shortcut is art direction only. It must change the setting, lighting, supporting graphics, mood, and composition—not the physical product.

CAMPAIGN BRIEF
Objective: ${template.objective}
Scene: ${template.scene}
Lighting: ${template.lighting}
Audience: ${audience}.
Channel and crop: ${platform}, ${ratio}; compose directly for this final aspect ratio and protect every important element from cropping.
Additional direction: ${notes.trim() || "No additional direction beyond the selected campaign and shortcut."}

MH OP DESIGN SYSTEM
Blend modern minimalism with restrained skeuomorphism, soft neomorphic depth, and premium glassmorphism. Use tactile surfaces, physically believable shadows, frosted translucent layers, clean hierarchy, and generous breathing room.
Palette: warm off-white and charcoal foundation; MH OP lime #C7F36B as the primary accent; controlled orange #FF6B35 only for urgency. Keep the result youthful, friendly, trustworthy, premium, and relevant to mobile gaming.
Composition: make the supplied product the unmistakable focal point. Establish clean foreground, midground, and background separation; intentional visual flow; mobile-feed readability; and believable scale. Supporting props must be secondary and must not touch or cover important product details.

AD COPY & LAYOUT
${textInstruction}

QUALITY & SAFETY GUARDRAILS
No additional brand logos, copied game characters, game screenshots, game UI, watermarks, fake awards, fabricated discounts, unverified performance claims, extra products, duplicated product parts, warped cables, deformed hardware, impossible reflections, floating objects without visual support, illegible text, random letters, clutter, cheap gradients, excessive bloom, plastic-looking materials, low resolution, or compression artifacts.
Do not remove or replace a genuine logo visible on Image 1. Do not place MH OP branding directly on the physical product; MH OP branding belongs only in the surrounding ad layout.

DELIVERY
Return one polished commercial key visual ready for ${platform} at ${ratio}. Prioritize exact product identity, visual impact, purchase confidence, and a recognizable MH OP campaign system. Before finalizing, compare the generated product against Image 1 and correct any difference in shape, color, details, or component count.`;
  }, [
    audience,
    cta,
    headline,
    notes,
    offer,
    platform,
    product,
    ratio,
    hasCatalogImage,
    shortcut,
    template,
    typography,
  ]);

  const copy = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(
        "Clipboard access was blocked. Select the prompt text and copy it manually.",
      );
    }
  };

  const reset = () => {
    setCampaign("Product hero");
    setShortcut("/advertising");
    setAudience("Myanmar mobile gamers aged 18-35");
    setHeadline("Hear every move.");
    setOffer("100% authentic, official store-direct product");
    setCta("Order now from MH OP");
    setTypography("Leave clean text-safe areas; add final copy later");
    setNotes("");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[.78fr_1.22fr]">
      <section className="card h-fit p-5 md:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#c7f36b]">
            <Sparkles size={19} />
          </span>
          <div>
            <p className="font-bold">Campaign brief</p>
            <p className="text-xs text-[#777]">
              No API · sourced from Products & Stock
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <label className="block text-xs font-bold">
            Product
            <select
              className={`${control} mt-1.5`}
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              {products.map((item) => (
                <option key={item.variantId} value={item.variantId}>
                  {item.name} · {item.sku}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-xs font-bold">Catalog reference image</p>
            {product && hasCatalogImage ? (
              <div className="mt-2 overflow-hidden rounded-2xl border bg-[#efede6]">
                <img
                  src={product.image}
                  alt={`${product.name} catalog reference`}
                  className="h-48 w-full object-contain"
                />
                <div className="flex items-center justify-between gap-3 border-t bg-white px-3 py-2">
                  <p className="truncate text-[10px] text-[#666]">
                    Shared with the live stock listing
                  </p>
                  <a
                    href={product.image}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[10px] font-bold underline"
                  >
                    Open image
                  </a>
                </div>
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-[#ffc7b4] bg-[#fff0eb] p-3 text-xs font-semibold text-[#9c3212]">
                This stock listing has no genuine product image yet. Add its
                HTTPS image in Products & Stock before creating an ad.
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-bold">
              Campaign
              <select
                className={`${control} mt-1.5`}
                value={campaign}
                onChange={(event) =>
                  setCampaign(event.target.value as Campaign)
                }
              >
                {Object.keys(campaigns).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold">
              MH OP shortcut
              <select
                className={`${control} mt-1.5 font-mono`}
                value={shortcut}
                onChange={(event) =>
                  setShortcut(event.target.value as Shortcut)
                }
              >
                {Object.keys(shortcuts).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-xl border bg-[#f7f5ef] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#77776f]">
              What the selected shortcut does
            </p>
            <p className="mt-2 font-mono text-sm font-bold">{shortcut}</p>
            <p className="mt-1 text-xs leading-5 text-[#666]">
              {shortcuts[shortcut]}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-bold">
              Channel
              <select
                className={`${control} mt-1.5`}
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
              >
                {[
                  "Facebook / Telegram",
                  "Instagram feed",
                  "Instagram story",
                  "TikTok cover",
                  "Website hero",
                  "Marketplace listing",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold">
              Aspect ratio
              <select
                className={`${control} mt-1.5`}
                value={ratio}
                onChange={(event) => setRatio(event.target.value)}
              >
                {[
                  "1:1 square",
                  "4:5 portrait",
                  "9:16 story",
                  "16:9 landscape",
                  "3:2 marketplace",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs font-bold">
            Target audience
            <input
              className={`${control} mt-1.5`}
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            />
          </label>
          <label className="block text-xs font-bold">
            Headline
            <input
              maxLength={100}
              className={`${control} mt-1.5`}
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
            />
          </label>
          <label className="block text-xs font-bold">
            Offer / proof
            <input
              maxLength={160}
              className={`${control} mt-1.5`}
              value={offer}
              onChange={(event) => setOffer(event.target.value)}
            />
          </label>
          <label className="block text-xs font-bold">
            Call to action
            <input
              maxLength={100}
              className={`${control} mt-1.5`}
              value={cta}
              onChange={(event) => setCta(event.target.value)}
            />
          </label>
          <label className="block text-xs font-bold">
            Typography workflow
            <select
              className={`${control} mt-1.5`}
              value={typography}
              onChange={(event) => setTypography(event.target.value)}
            >
              <option>Leave clean text-safe areas; add final copy later</option>
              <option>Render exact copy inside the image</option>
            </select>
          </label>
          <label className="block text-xs font-bold">
            Extra art direction
            <textarea
              maxLength={1000}
              className="mt-1.5 min-h-24 w-full rounded-xl border p-3 text-sm"
              placeholder="Feature to emphasize, setting, placement, campaign mood…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl border py-3 text-xs font-bold"
          >
            <RotateCcw size={14} className="mr-1 inline" />
            Reset brief
          </button>
        </div>
      </section>
      <section className="card flex min-h-[760px] flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <p className="eyebrow">Copy-ready output</p>
            <h2 className="display mt-1 text-2xl font-bold">
              Reference-aware master prompt
            </h2>
          </div>
          <button
            onClick={copy}
            className="rounded-full bg-black px-4 py-2.5 text-xs font-bold text-white"
          >
            {copied ? (
              <Check size={14} className="mr-1 inline" />
            ) : (
              <Clipboard size={14} className="mr-1 inline" />
            )}
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mx-5 mt-4 rounded-xl bg-[#fff0eb] p-3 text-xs font-bold text-[#9c3212]"
          >
            {error}
          </p>
        )}
        <div className="m-5 mb-2 rounded-xl bg-[#f1efe8] p-4 text-xs leading-5 text-[#666]">
          <div className="flex items-center gap-2 font-bold text-black">
            <ImageIcon size={15} />
            Two-step handoff
          </div>
          <ol className="mt-2 list-inside list-decimal">
            <li>
              Open the catalog image above and attach it in ChatGPT Images.
            </li>
            <li>
              Copy and paste the generated prompt, then generate. Reattach the
              image only if product details drift in later edits.
            </li>
          </ol>
        </div>
        <textarea
          readOnly
          aria-label="Generated master prompt"
          value={prompt}
          className="m-5 mt-3 min-h-[600px] flex-1 resize-y rounded-2xl border p-5 font-mono text-xs leading-6"
        />
      </section>
    </div>
  );
}
