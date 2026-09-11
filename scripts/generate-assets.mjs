import fs from "fs";
import path from "path";
import sharp from "sharp";

const publicDir = path.join(process.cwd(), "public");
const logoJpg = path.join(publicDir, "mhop-logo-minimal.jpg");

async function main() {
  const png512Buf = await sharp(logoJpg).resize(512, 512).png().toBuffer();
  const png512Base64 = png512Buf.toString("base64");

  const png1024Buf = await sharp(logoJpg).resize(1024, 1024).png().toBuffer();
  const png1024Base64 = png1024Buf.toString("base64");

  // 1. mhop-logo-square.svg
  const squareSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#000000" rx="64" />
  <image href="data:image/png;base64,${png1024Base64}" width="1024" height="1024" preserveAspectRatio="xMidYMid meet" />
</svg>
`;
  fs.writeFileSync(path.join(publicDir, "mhop-logo-square.svg"), squareSvg);

  // 2. mhop-logo.svg
  const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#000000" />
  <image href="data:image/png;base64,${png1024Base64}" width="1024" height="1024" preserveAspectRatio="xMidYMid meet" />
</svg>
`;
  fs.writeFileSync(path.join(publicDir, "mhop-logo.svg"), logoSvg);
  fs.writeFileSync(path.join(publicDir, "mhop-logo-transparent.svg"), logoSvg);

  // 3. telegram-bot-icon-512.svg
  const teleSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#000000" />
  <image href="data:image/png;base64,${png512Base64}" width="512" height="512" preserveAspectRatio="xMidYMid meet" />
</svg>
`;
  fs.writeFileSync(path.join(publicDir, "telegram-bot-icon-512.svg"), teleSvg);
  fs.writeFileSync(path.join(publicDir, "telegram-bot-dark-512.svg"), teleSvg);

  // 4. public/favicon.ico
  await sharp(logoJpg).resize(48, 48).png().toFile(path.join(publicDir, "favicon.ico"));

  console.log("All SVG and favicon assets regenerated successfully!");
}

main().catch(console.error);
