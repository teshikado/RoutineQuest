import path from "node:path";
import fs from "node:fs";
import {
  loadCanvas,
  saveCanvas,
  cropCanvas,
  createCanvas,
  getPixel,
  setPixel,
  floodFillBackground,
  connectedComponents,
  findOpaqueBounds,
  type Canvas,
} from "./pixel-canvas";

/** Extracts the 7x4 pet grid from the user-supplied reference sheet (public domain to this
 * project's own conversation -- copied from the attached image) into 28 individual transparent
 * per-creature PNGs, replacing public/hero/pets/*\/stage-*.png. This is pure image manipulation
 * (crop + background matte + connected-component isolation), not new illustration -- every
 * pixel of every creature comes directly from the source sheet. See the Abschlussbericht for
 * why the other two reference images (body-model chart, single hero+panther portrait) were NOT
 * treated the same way -- they are not decomposable into modular game assets the same way this
 * one is. */

const SRC = path.resolve(__dirname, "../../ref-images/ref-pets.png");
const OUT_ROOT = path.resolve(__dirname, "../../public/hero/pets");

// Species order top-to-bottom in the sheet == PET_SPECIES_ORDER in hero-constants.ts.
const SPECIES = ["wolf", "snake", "lion", "tiger", "bear", "eagle", "panther"];
const ROW_TOP = 70;
const ROW_H = (1086 - 70) / 7; // 145.14
const COL_BOUNDS = [248, 482, 738, 995, 1310]; // 4 columns, boundaries measured from the header diamond markers
const PAD = 55; // generous crop margin so nothing gets clipped before bbox-tightening

async function extractCell(src: Canvas, row: number, col: number): Promise<Canvas | null> {
  const cellTop = ROW_TOP + row * ROW_H;
  const cellBottom = ROW_TOP + (row + 1) * ROW_H;
  const cellLeft = COL_BOUNDS[col];
  const cellRight = COL_BOUNDS[col + 1];

  const x0 = Math.max(0, Math.round(cellLeft - PAD));
  const y0 = Math.max(0, Math.round(cellTop - PAD));
  const x1 = Math.min(src.width, Math.round(cellRight + PAD));
  const y1 = Math.min(src.height, Math.round(cellBottom + PAD));
  const w = x1 - x0, h = y1 - y0;

  const window = cropCanvas(src, x0, y0, w, h);
  const seeds: [number, number][] = [];
  for (let x = 0; x < w; x += 4) { seeds.push([x, 0]); seeds.push([x, h - 1]); }
  for (let y = 0; y < h; y += 4) { seeds.push([0, y]); seeds.push([w - 1, y]); }

  const cx = w / 2, cy = h / 2;

  // Dark-furred creatures (panther) sit on a near-black background with only a subtle glow
  // gradient between them -- a flood-fill threshold generous enough for high-contrast species
  // (wolf/bear/lion light fur) walks straight through low-contrast dark fur into the creature's
  // body. Rather than one fixed threshold, start conservative and only relax it if the result
  // looks too small to be the real creature, which keeps high-contrast species clean while
  // still fully separating dark ones instead of eating into them.
  let best: { pixels: [number, number][] } | null = null;
  for (const threshold of [9, 14, 20, 28]) {
    const bgMask = floodFillBackground(window, seeds, threshold);
    const fgMask = bgMask.map((v) => !v);
    const components = connectedComponents(fgMask, w, h);

    let candidate: { pixels: [number, number][] } | null = null;
    let bestScore = -Infinity;
    for (const comp of components) {
      if (comp.pixels.length < 150) continue; // discard sparkle/noise flecks
      let sx = 0, sy = 0;
      for (const [px, py] of comp.pixels) { sx += px; sy += py; }
      const centroidX = sx / comp.pixels.length, centroidY = sy / comp.pixels.length;
      const distFromCenter = Math.hypot(centroidX - cx, centroidY - cy);
      const score = comp.pixels.length - distFromCenter * 40;
      if (score > bestScore) { bestScore = score; candidate = comp; }
    }
    // A real creature fills a healthy fraction of its padded cell window; a fragment from a
    // flood-fill leak is much smaller. Accept the first threshold that clears this bar.
    if (candidate && candidate.pixels.length > w * h * 0.06) { best = candidate; break; }
    if (candidate && !best) best = candidate; // fallback if nothing ever clears the bar
  }
  if (!best) return null;

  const keep = new Array(w * h).fill(false);
  for (const [px, py] of best.pixels) keep[py * w + px] = true;

  const matted = createCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (keep[y * w + x]) setPixel(matted, x, y, getPixel(window, x, y));
  }

  const bounds = findOpaqueBounds(matted);
  if (!bounds) return null;
  const padOut = 3;
  const bx0 = Math.max(0, bounds.x0 - padOut);
  const by0 = Math.max(0, bounds.y0 - padOut);
  const bx1 = Math.min(w, bounds.x1 + padOut + 1);
  const by1 = Math.min(h, bounds.y1 + padOut + 1);
  return cropCanvas(matted, bx0, by0, bx1 - bx0, by1 - by0);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing source image at ${SRC}`);
    process.exit(1);
  }
  const src = await loadCanvas(SRC);
  let written = 0;
  for (let row = 0; row < SPECIES.length; row++) {
    const species = SPECIES[row];
    const outDir = path.join(OUT_ROOT, species);
    fs.mkdirSync(outDir, { recursive: true });
    for (let col = 0; col < 4; col++) {
      const result = await extractCell(src, row, col);
      if (!result) {
        console.error(`FAILED to isolate ${species} stage-${col + 1}`);
        continue;
      }
      await saveCanvas(result, path.join(outDir, `stage-${col + 1}.png`));
      written++;
      console.log(`${species} stage-${col + 1}: ${result.width}x${result.height}`);
    }
  }
  console.log(`extract-pets: wrote ${written}/28 pet images`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
