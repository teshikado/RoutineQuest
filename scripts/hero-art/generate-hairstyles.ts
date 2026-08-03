import path from "node:path";
import fs from "node:fs";
import {
  loadCanvas,
  saveCanvas,
  createCanvas,
  cloneCanvas,
  getPixel,
  blendPixel,
  diffMask,
  dilateMask,
  rowSilhouette,
  profile,
  type Canvas,
  type RGBA,
} from "./pixel-canvas";
import { HAIR_SHADING } from "./palettes";

/** Produces 8 real, distinct hairstyle overlay layers per gender x hair color (128 PNGs total),
 * on the same fixed canvas as the character body so they can be layered directly on top of it
 * in CharacterSprite (see hero-render-config.ts / character-sprite.tsx) instead of being baked
 * into the base body image. Two styles ("short-classic", "long-straight") are extracted
 * unchanged from the already hand-derived art via the pixel-diff hair mask (same technique
 * used to build the "lang" variant and the 8 hair colors earlier this session) so the two
 * previously-existing looks are preserved exactly. The other six are new, genuinely different
 * silhouettes built procedurally from row-profile shapes -- deterministic, palette-based, no
 * illustration tool involved. */

const CHAR_ROOT = path.resolve(__dirname, "../../public/hero/characters");
const OUT_ROOT = path.resolve(__dirname, "../../public/hero/hairstyles");
const GENDERS = ["male", "female"] as const;
const COLORS = ["black", "darkbrown", "brown", "blonde", "red", "gray", "silver", "purple"] as const;

export type HairStyleKey =
  | "short-classic" | "short-messy" | "short-side-part" | "short-warrior"
  | "long-straight" | "long-side-part" | "long-ponytail" | "long-warrior-braid";

export const HAIR_STYLE_KEYS: HairStyleKey[] = [
  "short-classic", "short-messy", "short-side-part", "short-warrior",
  "long-straight", "long-side-part", "long-ponytail", "long-warrior-braid",
];

type HeadGeo = { centerX: number; top: number; capBottom: number; width: number; height: number; halfExtent: number };

async function headGeo(gender: string): Promise<HeadGeo> {
  const a = await loadCanvas(path.join(CHAR_ROOT, gender, "variants", "medium--black.png"));
  const b = await loadCanvas(path.join(CHAR_ROOT, gender, "variants", "medium--blonde.png"));
  const mask = diffMask(a, b, 20, 0.42);
  let x0 = a.width, x1 = -1, y0 = a.height, y1 = -1;
  for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
    if (mask[y * a.width + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const centerX = Math.round((x0 + x1) / 2);
  // The existing hand-derived "short-classic" hair mask (x0..x1 above) already spans the full
  // head width incl. the sides -- every procedural style below scales its own width profile as
  // a *fraction* of this real measured half-extent instead of hand-guessed pixel counts, so a
  // "full" style genuinely covers the head and a "cropped" style is deliberately narrower than
  // it, rather than both being arbitrarily (and, as first drafted, far too) narrow.
  const halfExtent = Math.min(centerX - x0, x1 - centerX);
  return { centerX, top: y0, capBottom: y1, width: a.width, height: a.height, halfExtent };
}

async function extractExisting(gender: string, sourceDir: string, restrictTop: number): Promise<Record<string, Canvas>> {
  const out: Record<string, Canvas> = {};
  const black = await loadCanvas(path.join(CHAR_ROOT, gender, sourceDir, "medium--black.png"));
  const blonde = await loadCanvas(path.join(CHAR_ROOT, gender, sourceDir, "medium--blonde.png"));
  const mask = dilateMask(diffMask(black, blonde, 20, restrictTop), black.width, black.height, 1);
  for (const color of COLORS) {
    const src = await loadCanvas(path.join(CHAR_ROOT, gender, sourceDir, `medium--${color}.png`));
    const canvas = createCanvas(src.width, src.height);
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
      if (mask[y * src.width + x]) blendPixel(canvas, x, y, getPixel(src, x, y));
    }
    out[color] = canvas;
  }
  return out;
}

function shadeColor(colorKey: (typeof COLORS)[number], t: number, edgeFrac: number): RGBA {
  const s = HAIR_SHADING[colorKey];
  const [r, g, b, a] = edgeFrac > 0.8 ? s.shadow : edgeFrac > 0.45 ? s.base : t < 0.25 ? s.highlight : s.light;
  return [r, g, b, a];
}

// ---------- Procedural styles ----------

function shortMessy(geo: HeadGeo, colorKey: (typeof COLORS)[number]): Canvas {
  const c = createCanvas(geo.width, geo.height);
  const e = geo.halfExtent;
  const baseHalf = profile([[0, e * 0.42], [0.15, e * 0.88], [0.5, e * 0.95], [0.75, e * 0.8], [1, e * 0.55]]);
  rowSilhouette(c, geo.top - 3, geo.capBottom - geo.top + 6, geo.centerX, baseHalf, (t, dx) => shadeColor(colorKey, t, Math.abs(dx)));
  // jagged spikes poking above the dome -- deterministic pseudo-random offsets (no Math.random)
  const spikeSeeds = [0.12, 0.24, 0.35, 0.47, 0.58, 0.7, 0.82, 0.9];
  for (let i = 0; i < spikeSeeds.length; i++) {
    const frac = spikeSeeds[i];
    const x = Math.round(geo.centerX - e * 0.9 + frac * e * 1.8);
    const spikeH = 4 + ((i * 7) % 6);
    for (let dy = 0; dy < spikeH; dy++) {
      const y = geo.top - 3 - dy;
      const w = Math.max(0, 3 - Math.floor(dy / 2));
      for (let dx = -w; dx <= w; dx++) blendPixel(c, x + dx, y, shadeColor(colorKey, 0.1, dy === 0 ? 0.9 : 0.3));
    }
  }
  return c;
}

function shortSidePart(geo: HeadGeo, colorKey: (typeof COLORS)[number]): Canvas {
  const c = createCanvas(geo.width, geo.height);
  const e = geo.halfExtent;
  const half = profile([[0, e * 0.4], [0.2, e * 0.82], [0.55, e * 0.9], [0.8, e * 0.78], [1, e * 0.5]]);
  const partX = geo.centerX - e * 0.28; // asymmetric parting toward one side
  rowSilhouette(c, geo.top - 2, geo.capBottom - geo.top + 5, geo.centerX + Math.round(e * 0.08), half, (t, dx) => shadeColor(colorKey, t, Math.abs(dx)));
  // parting line + swept highlight streak
  for (let y = geo.top; y < geo.top + Math.round(geo.capBottom - geo.top) * 0.4; y++) {
    const drift = Math.round((y - geo.top) * 0.5);
    blendPixel(c, partX + drift, y, HAIR_SHADING[colorKey].shadow);
    blendPixel(c, partX + drift + Math.round(e * 0.16), y, HAIR_SHADING[colorKey].highlight);
  }
  return c;
}

function shortWarrior(geo: HeadGeo, colorKey: (typeof COLORS)[number]): Canvas {
  const c = createCanvas(geo.width, geo.height);
  const e = geo.halfExtent;
  // cropped-sides silhouette that still covers the head (not a thin mohawk): narrower than the
  // "messy"/"side-part" styles, but wide enough at the crown to read as a full short haircut.
  const half = profile([[0, e * 0.32], [0.15, e * 0.72], [0.4, e * 0.75], [0.55, e * 0.62], [0.7, e * 0.66], [1, e * 0.42]]);
  rowSilhouette(c, geo.top, geo.capBottom - geo.top - 4, geo.centerX, half, (t, dx) => shadeColor(colorKey, t, Math.abs(dx)));
  for (let dy = 0; dy < 5; dy++) {
    const w = Math.max(0, Math.round(e * 0.12) - dy);
    for (let dx = -w; dx <= w; dx++) blendPixel(c, geo.centerX - Math.round(e * 0.2) + dx, geo.top - dy, shadeColor(colorKey, 0.1, 0.2));
  }
  return c;
}

function longStraightSideVariant(geo: HeadGeo, colorKey: (typeof COLORS)[number], base: Canvas): Canvas {
  // Derived from the extracted long-straight overlay: keep the cap, but redraw the two locks
  // asymmetrically (one shorter, one longer, side-swept top) instead of the symmetric pair.
  const c = cloneCanvas(base);
  const tailTop = geo.capBottom - 6;
  const shortLen = 40, longLen = 78;
  for (const [dx0, len, w0] of [[-22, shortLen, 7], [20, longLen, 8]] as [number, number, number][]) {
    rowSilhouette(c, tailTop, len, geo.centerX + dx0, profile([[0, w0], [0.7, Math.round(w0 * 0.7)], [1, 1]]), (t, dx) => shadeColor(colorKey, t, Math.abs(dx)));
  }
  for (let y = geo.top; y < geo.top + 26; y++) {
    const drift = Math.round((y - geo.top) * 0.5);
    blendPixel(c, geo.centerX - 8 + drift, y, HAIR_SHADING[colorKey].highlight);
  }
  return c;
}

function ponytail(geo: HeadGeo, colorKey: (typeof COLORS)[number], cap: Canvas): Canvas {
  const c = cloneCanvas(cap);
  const tailTop = geo.top + 6;
  const tailLen = 96;
  rowSilhouette(c, tailTop, tailLen, geo.centerX, profile([[0, 9], [0.15, 7], [0.9, 4], [1, 1]]), (t, dx) => shadeColor(colorKey, t, Math.abs(dx)), true);
  // tie band
  for (let dx = -6; dx <= 6; dx++) blendPixel(c, geo.centerX + dx, tailTop + 4, HAIR_SHADING.black.shadow);
  return c;
}

function warriorBraid(geo: HeadGeo, colorKey: (typeof COLORS)[number], cap: Canvas): Canvas {
  const c = cloneCanvas(cap);
  const tailTop = geo.top + 10;
  const tailLen = 108;
  for (let i = 0; i < tailLen; i++) {
    const y = tailTop + i;
    const t = i / tailLen;
    const w = Math.max(1, Math.round(6 * (1 - t * 0.75)));
    const band = Math.floor(i / 4) % 2 === 0;
    for (let dx = -w; dx <= w; dx++) {
      const col = band ? HAIR_SHADING[colorKey].base : HAIR_SHADING[colorKey].shadow;
      blendPixel(c, geo.centerX + dx, y, col);
    }
  }
  return c;
}

async function main() {
  let written = 0;
  for (const gender of GENDERS) {
    const geo = await headGeo(gender);
    const shortClassic = await extractExisting(gender, "variants", 0.42);
    const longStraight = await extractExisting(gender, "variants-long", 0.65);

    for (const color of COLORS) {
      const outputs: Record<HairStyleKey, Canvas> = {
        "short-classic": shortClassic[color],
        "short-messy": shortMessy(geo, color),
        "short-side-part": shortSidePart(geo, color),
        "short-warrior": shortWarrior(geo, color),
        "long-straight": longStraight[color],
        "long-side-part": longStraightSideVariant(geo, color, longStraight[color]),
        "long-ponytail": ponytail(geo, color, shortClassic[color]),
        "long-warrior-braid": warriorBraid(geo, color, shortWarrior(geo, color)),
      };
      for (const style of HAIR_STYLE_KEYS) {
        const outDir = path.join(OUT_ROOT, style, gender);
        fs.mkdirSync(outDir, { recursive: true });
        await saveCanvas(outputs[style], path.join(outDir, `${color}.png`));
        written++;
      }
    }
  }
  console.log(`generate-hairstyles: wrote ${written} hairstyle overlay images`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
