// Icon/logo asset pipeline. Not part of the app build itself — run manually
// whenever the brand mark changes: `node build/generate-icon.js`.
//
// Source of truth: OPELogo.png at the repo root (the official neon purple
// checkmark logo, transparent background, designed to sit on dark UI).
// This script derives every other logo/icon asset from it:
//   - trimmed transparent PNGs for in-app use (nav, headers, login hero, splash)
//   - a square app-icon master (dark rounded-square backdrop + centered mark)
//   - PNGs at every size needed for web manifest / apple-touch-icon / favicon
//   - .ico files for the Next.js favicon, the Electron window icon, and the
//     Windows installer/EXE icon (electron-builder reads build/icon.ico)
//   - a .icns file for the macOS app/DMG icon (electron-builder reads
//     build/icon.icns; generated with png2icons, so this runs on any OS —
//     no macOS/iconutil required)
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { imagesToIco } = require("png-to-ico");
const png2icons = require("png2icons");

const root = path.join(__dirname, "..");
const SOURCE = path.join(root, "OPELogo.png");

const PUBLIC_LOGO_DIR = path.join(root, "public", "logo");
const PUBLIC_ICONS_DIR = path.join(root, "public", "icons");
const APP_DIR = path.join(root, "src", "app");
const ELECTRON_DIR = path.join(root, "electron");
const BUILD_DIR = __dirname;

const ICON_BG_TOP = "#1B0B33"; // deep purple
const ICON_BG_BOTTOM = "#050507"; // near-black

async function ensureDirs() {
  for (const dir of [PUBLIC_LOGO_DIR, PUBLIC_ICONS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Trims the transparent margin from the source logo, returns a sharp
// pipeline positioned at the given target width (height auto, aspect kept).
async function trimmedMark() {
  return sharp(SOURCE).trim({ threshold: 10 });
}

async function buildTransparentMarks() {
  const trimmed = await (await trimmedMark()).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const aspect = meta.height / meta.width;

  // Hi-res transparent mark for large display contexts (login hero, splash screen).
  await sharp(trimmed)
    .resize({ width: 960 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC_LOGO_DIR, "logo-mark.png"));

  // Small optimized transparent mark for inline use (nav, headers, topbar).
  await sharp(trimmed)
    .resize({ width: 240 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC_LOGO_DIR, "logo-mark-sm.png"));

  return { aspect };
}

// Builds the 1024x1024 square app-icon master: rounded dark-purple-to-black
// backdrop with the trimmed mark centered at ~62% of the canvas (breathing
// margin, matches standard app-icon safe-area conventions).
async function buildIconMaster() {
  const SIZE = 1024;
  const RADIUS = Math.round(SIZE * 0.22);

  const backdropSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${ICON_BG_TOP}"/>
          <stop offset="100%" stop-color="${ICON_BG_BOTTOM}"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stop-color="#A855F7" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#A855F7" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" fill="url(#bg)"/>
      <rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" fill="url(#glow)"/>
    </svg>
  `;

  const trimmed = await (await trimmedMark()).png().toBuffer();
  const markMeta = await sharp(trimmed).metadata();
  const markTargetWidth = Math.round(SIZE * 0.62);
  const markTargetHeight = Math.round((markMeta.height / markMeta.width) * markTargetWidth);
  const markResized = await sharp(trimmed).resize({ width: markTargetWidth }).png().toBuffer();

  const master = await sharp(Buffer.from(backdropSvg))
    .composite([
      {
        input: markResized,
        left: Math.round((SIZE - markTargetWidth) / 2),
        top: Math.round((SIZE - markTargetHeight) / 2) - Math.round(SIZE * 0.015),
      },
    ])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, "icon-master-1024.png"), master);
  return master;
}

async function buildIconSizes(masterBuffer) {
  const sizes = [16, 24, 32, 48, 64, 96, 128, 180, 192, 256, 384, 512];
  for (const size of sizes) {
    await sharp(masterBuffer)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(PUBLIC_ICONS_DIR, `icon-${size}.png`));
  }
  // Apple touch icon + web manifest convention filenames.
  await sharp(masterBuffer).resize(180, 180).png().toFile(path.join(APP_DIR, "apple-icon.png"));
  await sharp(masterBuffer).resize(512, 512).png().toFile(path.join(PUBLIC_ICONS_DIR, "icon-512-maskable.png"));
}

async function buildIcoAndFavicon(masterBuffer) {
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const rawImages = await Promise.all(
    icoSizes.map(async (size) => {
      const { data, info } = await sharp(masterBuffer)
        .resize(size, size)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height };
    })
  );
  const icoBuffer = await imagesToIco(rawImages);

  // Windows installer/EXE icon (electron-builder reads build/icon.ico).
  fs.writeFileSync(path.join(BUILD_DIR, "icon.ico"), icoBuffer);
  // Electron BrowserWindow + taskbar icon at runtime.
  fs.writeFileSync(path.join(ELECTRON_DIR, "icon.ico"), icoBuffer);
  // Browser tab favicon (Next.js picks up src/app/favicon.ico automatically).
  fs.writeFileSync(path.join(APP_DIR, "favicon.ico"), icoBuffer);

  // Also drop a flat 1024 PNG + the raw SVG-less master for reference/hi-res use.
  fs.copyFileSync(path.join(PUBLIC_ICONS_DIR, "icon-master-1024.png"), path.join(BUILD_DIR, "icon.png"));

  // Next.js app-icon convention (auto favicon + og fallback) at a crisp size.
  await sharp(masterBuffer).resize(512, 512).png().toFile(path.join(APP_DIR, "icon.png"));
}

// macOS .icns (covers 16pt up to 1024pt @1x/@2x — Dock, Finder, Launchpad,
// Spotlight, "About RoutineQuest", the .app bundle and the DMG icon all read
// from this single file). png2icons resizes internally from the 1024 master.
async function buildIcns(masterBuffer) {
  const icnsBuffer = png2icons.createICNS(masterBuffer, png2icons.BICUBIC2, 0);
  if (!icnsBuffer) {
    throw new Error("png2icons failed to produce build/icon.icns");
  }
  fs.writeFileSync(path.join(BUILD_DIR, "icon.icns"), icnsBuffer);
  fs.copyFileSync(path.join(BUILD_DIR, "icon.icns"), path.join(ELECTRON_DIR, "icon.icns"));
}

// DMG installer background: dark/purple, a soft arrow between where
// electron-builder places the .app icon and the Applications-folder link,
// plus a short instruction. Pure SVG (crisp at the exact DMG window size,
// no raster upscaling), matching package.json's dmg.window/contents coords.
const DMG_WIDTH = 660;
const DMG_HEIGHT = 400;

async function buildDmgBackground() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${DMG_WIDTH}" height="${DMG_HEIGHT}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0d0614"/>
          <stop offset="100%" stop-color="#050507"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#A855F7" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#A855F7" stop-opacity="0"/>
        </radialGradient>
        <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto">
          <path d="M0,0 L10,4 L0,8 Z" fill="#C084FC"/>
        </marker>
      </defs>
      <rect width="${DMG_WIDTH}" height="${DMG_HEIGHT}" fill="url(#bg)"/>
      <rect width="${DMG_WIDTH}" height="${DMG_HEIGHT}" fill="url(#glow)"/>
      <line x1="230" y1="185" x2="410" y2="185" stroke="#C084FC" stroke-width="3"
            stroke-dasharray="2 10" stroke-linecap="round" marker-end="url(#arrowhead)"/>
      <text x="${DMG_WIDTH / 2}" y="60" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
            font-size="22" font-weight="700" fill="#F8F7FC">RoutineQuest installieren</text>
      <text x="${DMG_WIDTH / 2}" y="285" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
            font-size="14" fill="#C8C5D2">In den Programme-Ordner ziehen, um RoutineQuest zu installieren</text>
    </svg>
  `;
  await sharp(Buffer.from(svg)).png().toFile(path.join(BUILD_DIR, "dmg-background.png"));
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Logo source not found: ${SOURCE}`);
  }
  await ensureDirs();
  await buildTransparentMarks();
  const master = await buildIconMaster();
  await buildIconSizes(master);
  await buildIcoAndFavicon(master);
  await buildIcns(master);
  await buildDmgBackground();

  console.log("Generated:");
  console.log("  public/logo/logo-mark.png, logo-mark-sm.png (transparent, in-app use)");
  console.log("  public/icons/icon-master-1024.png + icon-{16..512}.png, icon-512-maskable.png");
  console.log("  src/app/icon.png, src/app/apple-icon.png, src/app/favicon.ico");
  console.log("  build/icon.ico, build/icon.png, electron/icon.ico");
  console.log("  build/icon.icns, electron/icon.icns");
  console.log("  build/dmg-background.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
