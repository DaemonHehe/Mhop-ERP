import fs from "fs";
import path from "path";
import sharp from "sharp";

const rootDir = process.cwd();
const svgRaw = fs.readFileSync(path.join(rootDir, "public", "mhop-logo.svg"), "utf-8");

const orangeMatch = svgRaw.match(/<path d="([^"]+)" fill="#FE642B"/);
const blackMatch = svgRaw.match(/<path d="([^"]+)" fill="#171813"/);

if (!orangeMatch || !blackMatch) {
  console.error("Could not extract paths from mhop-logo.svg");
  process.exit(1);
}

const orangePath = orangeMatch[1];
const blackPath = blackMatch[1];

function generateSvg({
  scale = 0.52,
  bg = "#F6F7F1",
  fgOrange = "#FE642B",
  fgBlack = "#171813",
  hasBg = true,
  guide = false,
}) {
  const bgElement = hasBg ? `  <rect width="512" height="512" fill="${bg}" />\n` : "";
  const guideElement = guide
    ? `  <!-- Safe circle crop area guide for Telegram profile picture -->\n  <circle cx="256" cy="256" r="256" fill="none" stroke="#FE642B" stroke-dasharray="8 8" stroke-width="2" opacity="0.4" />\n`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
${bgElement}${guideElement}  <g transform="translate(256, 256) scale(${scale}) translate(-511.5, -512)">
    <path d="${orangePath}" fill="${fgOrange}" fill-rule="evenodd" />
    <path d="${blackPath}" fill="${fgBlack}" fill-rule="evenodd" />
  </g>
</svg>
`;
}

async function run() {
  const publicDir = path.join(rootDir, "public");

  // 1. Brand Cream 512x512 (Standard Official Telegram Icon)
  const creamSvg = generateSvg({
    scale: 0.52,
    bg: "#F6F7F1",
    fgOrange: "#FE642B",
    fgBlack: "#171813",
    hasBg: true,
  });
  const creamSvgPath = path.join(publicDir, "telegram-bot-icon-512.svg");
  fs.writeFileSync(creamSvgPath, creamSvg);

  const creamPngPath = path.join(publicDir, "telegram-bot-icon-512.png");
  await sharp(Buffer.from(creamSvg)).png().toFile(creamPngPath);

  const creamJpgPath = path.join(publicDir, "telegram-bot-icon-512.jpg");
  await sharp(Buffer.from(creamSvg)).jpeg({ quality: 98 }).toFile(creamJpgPath);

  // 2. Dark Gaming Theme 512x512
  const darkSvg = generateSvg({
    scale: 0.52,
    bg: "#171813",
    fgOrange: "#FE642B",
    fgBlack: "#F6F7F1",
    hasBg: true,
  });
  const darkSvgPath = path.join(publicDir, "telegram-bot-dark-512.svg");
  fs.writeFileSync(darkSvgPath, darkSvg);

  const darkPngPath = path.join(publicDir, "telegram-bot-dark-512.png");
  await sharp(Buffer.from(darkSvg)).png().toFile(darkPngPath);

  // 3. Transparent 512x512 (No Background)
  const transSvg = generateSvg({
    scale: 0.52,
    fgOrange: "#FE642B",
    fgBlack: "#171813",
    hasBg: false,
  });
  const transSvgPath = path.join(publicDir, "telegram-bot-transparent-512.svg");
  fs.writeFileSync(transSvgPath, transSvg);

  const transPngPath = path.join(publicDir, "telegram-bot-transparent-512.png");
  await sharp(Buffer.from(transSvg)).png().toFile(transPngPath);

  // 4. Circular guide preview
  const guideSvg = generateSvg({
    scale: 0.52,
    bg: "#F6F7F1",
    fgOrange: "#FE642B",
    fgBlack: "#171813",
    hasBg: true,
    guide: true,
  });
  fs.writeFileSync(path.join(publicDir, "telegram-bot-icon-guide-512.svg"), guideSvg);

  console.log("Successfully generated all Telegram bot icons!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
