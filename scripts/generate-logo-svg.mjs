import sharp from "sharp";
import potrace from "potrace";
import { writeFileSync } from "node:fs";

async function generateSvg() {
  console.log("Analyzing public/mhop-logo-minimal.jpg...");
  const { data, info } = await sharp("public/mhop-logo-minimal.jpg")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;

  const orangeBuf = Buffer.alloc(width * height);
  const blackBuf = Buffer.alloc(width * height);

  let minX = width, maxX = 0, minY = height, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const idx = i * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Orange letter detection
      if (r > 170 && g < 140 && b < 80) {
        orangeBuf[i] = 0; // foreground
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else {
        orangeBuf[i] = 255;
      }

      // Black letter detection
      if (r < 80 && g < 80 && b < 80) {
        blackBuf[i] = 0; // foreground
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else {
        blackBuf[i] = 255;
      }
    }
  }

  console.log(`Logo bounds: minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}`);

  const orangePng = await sharp(orangeBuf, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

  const blackPng = await sharp(blackBuf, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

  const trace = (buf) =>
    new Promise((resolve, reject) => {
      potrace.trace(
        buf,
        {
          optCurve: true,
          optTolerance: 0.2,
          turdSize: 3,
          turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
          color: "#FE642B",
        },
        (err, svg) => {
          if (err) reject(err);
          else resolve(svg);
        },
      );
    });

  const [orangeSvg, blackSvg] = await Promise.all([
    trace(orangePng),
    trace(blackPng),
  ]);

  const extractPath = (svg) => {
    const match = svg.match(/<path[^>]*\sd="([^"]+)"/);
    return match ? match[1] : "";
  };

  const orangePath = extractPath(orangeSvg);
  const blackPath = extractPath(blackSvg);

  // Add 16px padding to bounds
  const pad = 20;
  const viewBoxX = Math.max(0, minX - pad);
  const viewBoxY = Math.max(0, minY - pad);
  const viewBoxW = maxX - minX + pad * 2;
  const viewBoxH = maxY - minY + pad * 2;

  // 1. Tight ViewBox SVG (for headers, icons, UI components)
  const logoSvgTight = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}" width="${viewBoxW}" height="${viewBoxH}" fill="none">
  <!-- MH OP Official Logo (Vector SVG) -->
  <path d="${orangePath}" fill="#FE642B" fill-rule="evenodd" />
  <path d="${blackPath}" fill="#171813" fill-rule="evenodd" />
</svg>
`;

  // 2. Full Canvas 1024x1024 SVG (with optional light cream background or transparent)
  const logoSvgFull = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" fill="none">
  <rect width="1024" height="1024" fill="#F6F7F1" rx="64" />
  <path d="${orangePath}" fill="#FE642B" fill-rule="evenodd" />
  <path d="${blackPath}" fill="#171813" fill-rule="evenodd" />
</svg>
`;

  // 3. Transparent Full Canvas SVG
  const logoSvgTransparent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" fill="none">
  <path d="${orangePath}" fill="#FE642B" fill-rule="evenodd" />
  <path d="${blackPath}" fill="#171813" fill-rule="evenodd" />
</svg>
`;

  writeFileSync("public/mhop-logo.svg", logoSvgTight.trim());
  writeFileSync("public/mhop-logo-square.svg", logoSvgFull.trim());
  writeFileSync("public/mhop-logo-transparent.svg", logoSvgTransparent.trim());

  console.log("Successfully generated:");
  console.log("- public/mhop-logo.svg (tight viewBox for headers & navigation)");
  console.log("- public/mhop-logo-square.svg (1024x1024 with brand cream background)");
  console.log("- public/mhop-logo-transparent.svg (1024x1024 transparent)");
}

generateSvg().catch((err) => {
  console.error("Error generating SVG:", err);
  process.exit(1);
});
