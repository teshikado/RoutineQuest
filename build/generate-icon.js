// One-off icon generator. Not part of the app build itself — run manually
// whenever the brand mark changes: `node build/generate-icon.js`.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { imagesToIco } = require("png-to-ico");

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1024" height="1024">
  <rect x="0" y="0" width="24" height="24" rx="5.4" fill="#4FA8D8"/>
  <path
    d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
    fill="#ffffff"
  />
</svg>
`;

const outDir = __dirname;
const sizes = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  const svgBuffer = Buffer.from(SVG);

  fs.writeFileSync(path.join(outDir, "icon.svg"), SVG.trim());

  const pngPath1024 = path.join(outDir, "icon.png");
  await sharp(svgBuffer, { density: 384 }).resize(1024, 1024).png().toFile(pngPath1024);

  const rawImages = await Promise.all(
    sizes.map(async (size) => {
      const { data, info } = await sharp(svgBuffer, { density: 384 })
        .resize(size, size)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height };
    })
  );

  const icoBuffer = await imagesToIco(rawImages);
  fs.writeFileSync(path.join(outDir, "icon.ico"), icoBuffer);

  // Also drop a copy inside electron/ so the BrowserWindow can reference it
  // directly at runtime (the `build/` folder itself is not shipped — it's
  // only electron-builder's source for embedding the .exe resource icon).
  fs.copyFileSync(path.join(outDir, "icon.ico"), path.join(outDir, "..", "electron", "icon.ico"));

  console.log("Generated build/icon.svg, build/icon.png, build/icon.ico, electron/icon.ico");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
