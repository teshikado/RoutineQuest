import path from "node:path";
import fs from "node:fs";
import {
  loadCanvas,
  saveCanvas,
  cloneCanvas,
  setPixel,
  diffMask,
  dilateMask,
  rowReshapeClamped,
  findOpaqueBounds,
  profile,
  type Canvas,
} from "./pixel-canvas";
import { SKIN_SHADING } from "./palettes";

/** Builds a "bald" body-build base per gender x skin (hair removed) and then reshapes it into
 * five real per-row silhouettes -- see BUILD_PROFILES below. This replaces the old approach
 * (CSS transform: scale(scaleX, scaleY) on the whole finished sprite) with genuinely different
 * body proportions per build: the head and feet rows are left untouched while the shoulder,
 * chest, waist, hip and leg rows are independently widened or narrowed, which is what actually
 * changes the silhouette instead of uniformly stretching a copy of the same figure. Output
 * canvas size is kept identical to the source (171x315) so the existing percentage-based
 * ARMOR_ZONES / WEAPON_ZONES in character-sprite.tsx keep lining up with no changes needed
 * there -- only the pixels inside that fixed frame differ per build. */

const ROOT = path.resolve(__dirname, "../../public/hero/characters");
const GENDERS = ["male", "female"] as const;
const SKINS = ["very-light", "light", "medium", "dark", "very-dark"] as const;
const HAIR_A = "black";
const HAIR_B = "blonde"; // maximally different hue/lightness from black -> most reliable diff mask

export type BodyBuildKey = "duenn" | "normal" | "muskuloes" | "kraeftig" | "stabil";

// t = row fraction (0 = top of canvas, 1 = bottom). Keyframes are (t, widthMultiplier).
// Head (~0-0.16) and feet (~0.92-1.0) are pinned at 1 for every build so the head silhouette
// and ground contact point never change -- only torso/limb proportions differ.
// Widen multipliers are the *requested* per-row scale -- rowReshapeClamped (pixel-canvas.ts)
// measures each row's actual opaque content against the fixed 171px canvas at generation time
// and automatically caps the effective scale so nothing clips off-frame, so these can safely
// express the full intended silhouette without being hand-tuned against measured margins.
const BUILD_PROFILES: Record<BodyBuildKey, [number, number][]> = {
  duenn: [
    [0, 1], [0.16, 1], [0.22, 0.88], [0.32, 0.84], [0.42, 0.82], [0.5, 0.83],
    [0.56, 0.87], [0.64, 0.89], [0.78, 0.9], [0.92, 0.94], [1, 1],
  ],
  normal: [[0, 1], [1, 1]],
  muskuloes: [
    [0, 1], [0.16, 1], [0.2, 1.06], [0.26, 1.16], [0.32, 1.13], [0.42, 1.06],
    [0.5, 0.94], [0.56, 0.97], [0.64, 1.05], [0.78, 1.12], [0.92, 1.06], [1, 1],
  ],
  kraeftig: [
    [0, 1], [0.16, 1], [0.2, 1.12], [0.26, 1.28], [0.32, 1.26], [0.42, 1.4],
    [0.5, 1.3], [0.56, 1.22], [0.64, 1.16], [0.78, 1.26], [0.92, 1.18], [1, 1],
  ],
  stabil: [
    [0, 1], [0.16, 1], [0.2, 1.06], [0.26, 1.12], [0.32, 1.18], [0.42, 1.32],
    [0.5, 1.35], [0.56, 1.24], [0.64, 1.15], [0.78, 1.18], [0.92, 1.1], [1, 1],
  ],
};

export const BUILD_KEYS: BodyBuildKey[] = ["duenn", "normal", "muskuloes", "kraeftig", "stabil"];

function scalpFill(c: Canvas, mask: boolean[], skin: keyof typeof SKIN_SHADING, bbox: { x0: number; x1: number }) {
  const shading = SKIN_SHADING[skin];
  const cx = (bbox.x0 + bbox.x1) / 2;
  const halfW = Math.max(1, (bbox.x1 - bbox.x0) / 2);
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = y * c.width + x;
      if (!mask[i]) continue;
      const rel = Math.abs(x - cx) / halfW;
      const color = rel < 0.35 ? shading.light : rel < 0.75 ? shading.base : shading.shadow;
      setPixel(c, x, y, color);
    }
  }
}

async function buildBaldBase(gender: string, skin: string): Promise<Canvas> {
  const a = await loadCanvas(path.join(ROOT, gender, "variants", `${skin}--${HAIR_A}.png`));
  const b = await loadCanvas(path.join(ROOT, gender, "variants", `${skin}--${HAIR_B}.png`));
  const mask = dilateMask(diffMask(a, b, 20, 0.42), a.width, a.height, 1);
  const bald = cloneCanvas(a);
  const bbox = findOpaqueBounds(a) ?? { x0: 0, x1: a.width };
  scalpFill(bald, mask, skin as keyof typeof SKIN_SHADING, bbox);
  return bald;
}

async function main() {
  let written = 0;
  for (const gender of GENDERS) {
    for (const skin of SKINS) {
      const bald = await buildBaldBase(gender, skin);
      const bounds = findOpaqueBounds(bald);
      const centerX = bounds ? Math.round((bounds.x0 + bounds.x1) / 2) : Math.round(bald.width / 2);
      for (const build of BUILD_KEYS) {
        const reshaped = build === "normal" ? bald : rowReshapeClamped(bald, centerX, profile(BUILD_PROFILES[build]));
        const outDir = path.join(ROOT, gender, "body", build);
        fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, `${skin}.png`);
        await saveCanvas(reshaped, outPath);
        written++;
      }
    }
  }
  console.log(`generate-bodies: wrote ${written} bald body-build base images`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
