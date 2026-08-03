import path from "node:path";
import fs from "node:fs";
import {
  loadCanvas,
  saveCanvas,
  createCanvas,
  resizeNearest,
  pasteInto,
  findOpaqueBoundsRow,
  conformRowsToTarget,
  type Canvas,
} from "./pixel-canvas";
import { BUILD_KEYS, type BodyBuildKey } from "./generate-bodies";

/** Turns each armor set's flat inventory icon into a real body-conforming character overlay,
 * one per gender x body-build (HELMET is gender-only -- the head silhouette is pinned identical
 * across every build, see BUILD_PROFILES in generate-bodies.ts). Nothing about the icon art
 * itself changes -- same gems, plates, seams, colors -- only its placement and per-row width are
 * adjusted so it hugs the real measured body silhouette instead of floating inside a
 * fixed-aspect box (the bug that caused a bare-skin gap on every build, see the Abschlussbericht).
 *
 * Algorithm per (set, slot, gender, build):
 *  1. Resize the icon (nearest-neighbor, aspect-preserving) to fit inside the same placement box
 *     the old CSS object-contain approach used, and paste it onto a full native-size canvas at
 *     that box's center -- this reproduces the old baseline position/size exactly.
 *  2. Re-run every row of that pasted icon through conformRowsToTarget against the *real* body
 *     PNG's own measured per-row opaque bounds for that exact gender+build, so the icon's
 *     rendered width converges on the body's actual width (plus a small armor-plating padding)
 *     at every row -- not by a hand-tuned box, but by direct measurement. */

const PUB = path.resolve(__dirname, "../../public/hero");
const ARMOR_ROOT = path.join(PUB, "armor-sets");
const CHAR_ROOT = path.join(PUB, "characters");
const GENDERS = ["male", "female"] as const;
type Gender = (typeof GENDERS)[number];

const NATIVE_SIZE: Record<Gender, { width: number; height: number }> = {
  male: { width: 171, height: 315 },
  female: { width: 163, height: 316 },
};

const ARMOR_SET_KEYS = [
  "iron-guard", "wander-hunter", "north-fur",
  "sapphire-guard", "arcane-keeper", "night-runner",
  "void-guard", "rune-lord", "shadow-blade",
  "sky-warden", "sun-king", "star-breaker", "samurai",
] as const;

type Slot = "HELMET" | "CHEST" | "PANTS" | "SHOES";
const SLOT_ICON_FILE: Record<Slot, string> = { HELMET: "helmet-icon.png", CHEST: "chest-icon.png", PANTS: "pants-icon.png", SHOES: "shoes-icon.png" };
const SLOT_DIR: Record<Slot, string> = { HELMET: "helmet", CHEST: "chest", PANTS: "pants", SHOES: "shoes" };

// Baseline placement box (fraction of native canvas) -- only a starting position/size for the
// icon before per-row conforming takes over; keeps the vertical anchor (where torso/hip/foot
// art starts) at the value already tuned against the base sprite's own landmarks.
const PLACEMENT: Record<Slot, { top: number; left: number; width: number; height: number }> = {
  HELMET: { top: 0.03, left: 0.19, width: 0.62, height: 0.33 },
  CHEST: { top: 0.27, left: 0.11, width: 0.78, height: 0.5 },
  PANTS: { top: 0.55, left: 0.19, width: 0.62, height: 0.36 },
  SHOES: { top: 0.81, left: 0.23, width: 0.54, height: 0.18 },
};

// Small outward padding (px, on the fixed native canvas) so armor reads as sitting *on top of*
// the body rather than being exactly skin-width -- kept small since these are already close
// crops, a large padding would make the armor balloon past a believable silhouette.
const PADDING_PX: Record<Slot, number> = { HELMET: 3, CHEST: 2, PANTS: 1, SHOES: 2 };

const bodyRowBoundsCache = new Map<string, ([number, number] | null)[]>();

async function bodyRowBounds(gender: Gender, build: BodyBuildKey): Promise<([number, number] | null)[]> {
  const key = `${gender}:${build}`;
  const cached = bodyRowBoundsCache.get(key);
  if (cached) return cached;
  const body = await loadCanvas(path.join(CHAR_ROOT, gender, "body", build, "medium.png"));
  const bounds: ([number, number] | null)[] = [];
  for (let y = 0; y < body.height; y++) bounds.push(findOpaqueBoundsRow(body, y));
  bodyRowBoundsCache.set(key, bounds);
  return bounds;
}

function placeIconOnCanvas(icon: Canvas, gender: Gender, slot: Slot): Canvas {
  const { width: W, height: H } = NATIVE_SIZE[gender];
  const box = PLACEMENT[slot];
  const zx0 = Math.round(box.left * W);
  const zy0 = Math.round(box.top * H);
  const zw = Math.round(box.width * W);
  const zh = Math.round(box.height * H);
  const scale = Math.min(zw / icon.width, zh / icon.height);
  const rw = Math.max(1, Math.round(icon.width * scale));
  const rh = Math.max(1, Math.round(icon.height * scale));
  const resized = resizeNearest(icon, rw, rh);
  const canvas = createCanvas(W, H);
  const ox = zx0 + Math.round((zw - rw) / 2);
  const oy = zy0 + Math.round((zh - rh) / 2);
  pasteInto(canvas, resized, ox, oy);
  return canvas;
}

async function generateOne(setKey: string, slot: Slot, gender: Gender, build: BodyBuildKey): Promise<Canvas> {
  const icon = await loadCanvas(path.join(ARMOR_ROOT, setKey, SLOT_ICON_FILE[slot]));
  const placed = placeIconOnCanvas(icon, gender, slot);
  // HELMET is a rigid object (dome + flared neck plates), not a soft covering that should taper
  // to match the neckline/shoulder width below it -- conforming it row-by-row to body width the
  // way CHEST/PANTS/SHOES are was tried and made every helmet balloon into a shoulder-wide black
  // mass covering the whole face, since the placement box's lower rows sit right at the
  // shoulder line. It keeps its simple resize-to-box placement (matching the already-correct
  // helmet fit from before this pass) with no further reshaping.
  if (slot === "HELMET") return placed;
  const bounds = await bodyRowBounds(gender, build);
  return conformRowsToTarget(
    placed,
    (y) => (bounds[y] ? (bounds[y]![1] - bounds[y]![0]) / 2 : null),
    (y) => (bounds[y] ? (bounds[y]![0] + bounds[y]![1]) / 2 : null),
    PADDING_PX[slot]
  );
}

async function main() {
  let written = 0;
  for (const setKey of ARMOR_SET_KEYS) {
    for (const gender of GENDERS) {
      // HELMET: build-independent, one file per gender.
      const helmet = await generateOne(setKey, "HELMET", gender, "normal");
      const helmetDir = path.join(ARMOR_ROOT, setKey, "overlay", "helmet");
      fs.mkdirSync(helmetDir, { recursive: true });
      await saveCanvas(helmet, path.join(helmetDir, `${gender}.png`));
      written++;

      for (const slot of ["CHEST", "PANTS", "SHOES"] as Slot[]) {
        for (const build of BUILD_KEYS) {
          const overlay = await generateOne(setKey, slot, gender, build);
          const outDir = path.join(ARMOR_ROOT, setKey, "overlay", SLOT_DIR[slot], gender);
          fs.mkdirSync(outDir, { recursive: true });
          await saveCanvas(overlay, path.join(outDir, `${build}.png`));
          written++;
        }
      }
    }
  }
  console.log(`generate-armor-overlays: wrote ${written} body-conforming armor overlay images`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
