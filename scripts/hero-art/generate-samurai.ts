import path from "node:path";
import fs from "node:fs";
import { createCanvas, saveCanvas, blendPixel, rowSilhouette, profile, type Canvas, type RGBA } from "./pixel-canvas";
import { SAMURAI_PALETTE } from "./palettes";

/** Fourth legendary armor style ("Samurai") that did not exist anywhere in the original asset
 * set (no kabuto-style helm exists in the reference sheets this project's art came from). Built
 * procedurally on the same fixed per-slot canvas size as the other 11 armor sets (see the
 * sky-warden/star-breaker icon dimensions probed while building this) so it drops into the
 * existing armorSetIconSrc()/ARMOR_ZONES pipeline with zero changes there. Palette: lacquer
 * black, deep red, violet, gold -- per the brief. Deliberately simpler/flatter shading than the
 * 12 hand-painted sets (procedural flat-shaded silhouettes, not illustration) -- see the
 * Abschlussbericht for why that gap exists and can't be closed without an illustration tool. */

const OUT = path.resolve(__dirname, "../../public/hero/armor-sets/samurai");
const { lacquerBlack: BLACK, deepRed: RED, violet: VIOLET, gold: GOLD } = SAMURAI_PALETTE;

function edgeShade(base: typeof BLACK, edgeFrac: number): RGBA {
  return edgeFrac > 0.75 ? base.shadow : edgeFrac < 0.25 ? base.light : base.base;
}

function gem(c: Canvas, cx: number, cy: number, r: number) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const edge = Math.sqrt(dx * dx + dy * dy) / r;
    blendPixel(c, cx + dx, cy + dy, edge > 0.7 ? VIOLET.shadow : edge < 0.3 ? VIOLET.highlight : VIOLET.base);
  }
  blendPixel(c, cx - Math.round(r * 0.3), cy - Math.round(r * 0.3), [255, 255, 255, 200]);
}

function goldRim(c: Canvas, y: number, x0: number, x1: number, thickness = 2) {
  for (let t = 0; t < thickness; t++) for (let x = x0; x <= x1; x++) blendPixel(c, x, y + t, GOLD.base);
}

// ---------- Helmet: kabuto-inspired dome, flared neck plates, gold crescent horns, violet gem ----------
function drawHelmet(): Canvas {
  const W = 92, H = 108;
  const c = createCanvas(W, H);
  const cx = W / 2;
  // dome
  rowSilhouette(c, 8, 46, cx, profile([[0, 8], [0.3, 30], [0.7, 33], [1, 26]]), (t, dx) => edgeShade(BLACK, Math.abs(dx)));
  // flared segmented neck guard (3 descending plates)
  for (let i = 0; i < 3; i++) {
    const y0 = 46 + i * 9;
    rowSilhouette(c, y0, 10, cx, profile([[0, 40 - i * 2], [1, 44 - i * 2]]), (t, dx) => edgeShade(RED, Math.abs(dx)));
    goldRim(c, y0, Math.round(cx - 40 + i * 2), Math.round(cx + 40 - i * 2));
  }
  // gold brim + rim
  goldRim(c, 8, Math.round(cx - 10), Math.round(cx + 10));
  goldRim(c, 44, Math.round(cx - 32), Math.round(cx + 32), 3);
  // crescent horns -- curl up and outward from the brim, tip staying within the canvas
  for (const side of [-1, 1]) {
    for (let i = 0; i < 22; i++) {
      const t = i / 22;
      const x = Math.round(cx + side * (9 + t * 22));
      const y = Math.max(0, Math.round(11 - t * 10 - Math.sin(t * Math.PI * 0.5) * 2));
      const w = t > 0.8 ? 0 : 1;
      for (let dw = -w; dw <= w; dw++) blendPixel(c, x + dw, y, GOLD.base);
      blendPixel(c, x, Math.max(0, y - 1), GOLD.light);
    }
  }
  gem(c, Math.round(cx), 30, 5);
  return c;
}

// ---------- Chest: layered lamellar plates, gold trim, violet gem ----------
function drawChest(): Canvas {
  const W = 118, H = 143;
  const c = createCanvas(W, H);
  const cx = W / 2;
  rowSilhouette(c, 6, 118, cx, profile([[0, 28], [0.15, 40], [0.4, 44], [0.6, 40], [0.85, 34], [1, 26]]), (t, dx) => edgeShade(BLACK, Math.abs(dx)));
  // lamellar bands
  for (let band = 0; band < 6; band++) {
    const y = 34 + band * 13;
    const half = 38 - band * 1.5;
    goldRim(c, y, Math.round(cx - half), Math.round(cx + half), 1);
    for (let x = Math.round(cx - half) + 3; x < Math.round(cx + half) - 3; x += 6) blendPixel(c, x, y + 4, RED.base);
  }
  // shoulder plates
  for (const side of [-1, 1]) {
    rowSilhouette(c, 10, 20, cx + side * 34, profile([[0, 6], [0.5, 12], [1, 8]]), (t, dx) => edgeShade(RED, Math.abs(dx)));
  }
  goldRim(c, 6, Math.round(cx - 26), Math.round(cx + 26), 2);
  gem(c, cx, 56, 7);
  return c;
}

// ---------- Pants: wide hakama-style silhouette, pleat lines, gold waist trim ----------
function drawPants(): Canvas {
  const W = 86, H = 130;
  const c = createCanvas(W, H);
  const cx = W / 2;
  rowSilhouette(c, 4, 122, cx, profile([[0, 26], [0.12, 30], [0.4, 34], [0.6, 30], [0.75, 24], [1, 18]]), (t, dx) => edgeShade(BLACK, Math.abs(dx)));
  goldRim(c, 4, Math.round(cx - 22), Math.round(cx + 22), 3);
  // center split + pleats
  for (let y = 20; y < 118; y++) blendPixel(c, cx, y, BLACK.shadow);
  for (const side of [-1, 1]) {
    for (let i = 1; i <= 3; i++) {
      const x = cx + side * i * 7;
      for (let y = 24; y < 110; y += 1) if (y % 5 !== 0) blendPixel(c, x, y, RED.shadow);
    }
  }
  return c;
}

// ---------- Shoes: armored tabi boots, gold band ----------
function drawShoes(): Canvas {
  const W = 84, H = 102;
  const c = createCanvas(W, H);
  for (const side of [-1, 1]) {
    const cx = W / 2 + side * 19;
    rowSilhouette(c, 10, 74, cx, profile([[0, 12], [0.5, 15], [0.85, 17], [1, 13]]), (t, dx) => edgeShade(BLACK, Math.abs(dx)));
    goldRim(c, 34, Math.round(cx - 15), Math.round(cx + 15), 3);
    for (let x = Math.round(cx - 15); x <= Math.round(cx + 15); x++) blendPixel(c, x, 84, RED.base);
  }
  return c;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await saveCanvas(drawHelmet(), path.join(OUT, "helmet-icon.png"));
  await saveCanvas(drawChest(), path.join(OUT, "chest-icon.png"));
  await saveCanvas(drawPants(), path.join(OUT, "pants-icon.png"));
  await saveCanvas(drawShoes(), path.join(OUT, "shoes-icon.png"));
  console.log("generate-samurai: wrote 4 armor pieces to", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
