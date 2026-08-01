import type { PetSpecies } from "@prisma/client";
import { PixelCanvas, type PixelBlock } from "./pixel-canvas";

/** Per-species palette (base body / darker shade / small accent) and silhouette shape.
 * All seven are built from the same small set of geometric primitives (body, head, ears,
 * tail, legs) with per-species proportions and accents -- this keeps every animal an
 * original, coherent shape (not photoreal, but clearly distinct and readable at small
 * sizes) rather than random noise, while staying implementable as plain code with no
 * external art assets. */
type QuadrupedParams = {
  base: string;
  shade: string;
  accent: string;
  earStyle: "pointed" | "round" | "small";
  mane: boolean;
  stripes: boolean;
  bodyHeight: number;
  tailLength: "short" | "long";
};

const QUADRUPED_PARAMS: Record<"WOLF" | "LION" | "TIGER" | "BEAR" | "PANTHER", QuadrupedParams> = {
  WOLF: { base: "#8B93A6", shade: "#5B6478", accent: "#D8DCE6", earStyle: "pointed", mane: false, stripes: false, bodyHeight: 4, tailLength: "long" },
  LION: { base: "#E3A857", shade: "#B87F35", accent: "#FFDFA0", earStyle: "round", mane: true, stripes: false, bodyHeight: 4, tailLength: "short" },
  TIGER: { base: "#F0924A", shade: "#C06A2A", accent: "#2A1E16", earStyle: "pointed", mane: false, stripes: true, bodyHeight: 4, tailLength: "long" },
  BEAR: { base: "#7A5A3C", shade: "#523C28", accent: "#C9A97A", earStyle: "round", mane: false, stripes: false, bodyHeight: 5, tailLength: "short" },
  PANTHER: { base: "#2A2A38", shade: "#17171F", accent: "#A855F7", earStyle: "small", mane: false, stripes: false, bodyHeight: 3, tailLength: "long" },
};

function buildQuadrupedBlocks(p: QuadrupedParams, detailLevel: 1 | 2 | 3 | 4): PixelBlock[] {
  const blocks: PixelBlock[] = [];
  const bodyY = 10 - p.bodyHeight;

  // Legs
  const legXs = [3, 5.5, 9, 11.5];
  for (const x of legXs) blocks.push({ x, y: 9, w: 1.5, h: 2, fill: p.shade });

  // Body
  blocks.push({ x: 3, y: bodyY, w: 9.5, h: p.bodyHeight, fill: p.base });
  // Belly shade line
  blocks.push({ x: 3, y: bodyY + p.bodyHeight - 1, w: 9.5, h: 1, fill: p.shade, opacity: 0.6 });

  // Tail
  if (p.tailLength === "long") {
    blocks.push({ x: 1, y: bodyY + 1, w: 2, h: 1, fill: p.shade });
    blocks.push({ x: 0.3, y: bodyY - 1, w: 1.2, h: 2.2, fill: p.shade });
  } else {
    blocks.push({ x: 1.5, y: bodyY + 1, w: 1.5, h: 1.2, fill: p.shade });
  }

  // Head
  const headX = 11.5;
  const headY = bodyY - 2.2;
  blocks.push({ x: headX, y: headY, w: 4, h: 4, fill: p.base });
  // Snout
  blocks.push({ x: headX + 3.6, y: headY + 2, w: 1.4, h: 1.4, fill: p.shade });

  // Mane (Lion)
  if (p.mane && detailLevel >= 1) {
    const maneCoords = [
      [headX - 0.8, headY - 0.6],
      [headX + 1.2, headY - 1],
      [headX + 3, headY - 0.6],
      [headX - 0.8, headY + 1.8],
      [headX + 4.2, headY + 1.8],
      [headX - 0.8, headY + 3.4],
      [headX + 4.2, headY + 3.4],
      [headX + 1.2, headY + 4.4],
    ];
    for (const [mx, my] of maneCoords) blocks.push({ x: mx, y: my, w: 1.4, h: 1.4, fill: p.accent, opacity: 0.9 });
  }

  // Ears
  if (p.earStyle === "pointed") {
    blocks.push({ x: headX + 0.2, y: headY - 1.4, w: 1, h: 1.6, fill: p.base });
    blocks.push({ x: headX + 2.6, y: headY - 1.4, w: 1, h: 1.6, fill: p.base });
  } else if (p.earStyle === "round") {
    blocks.push({ x: headX + 0.1, y: headY - 1, w: 1.2, h: 1.2, fill: p.base });
    blocks.push({ x: headX + 2.6, y: headY - 1, w: 1.2, h: 1.2, fill: p.base });
  } else {
    blocks.push({ x: headX + 0.3, y: headY - 0.8, w: 0.8, h: 1, fill: p.base });
    blocks.push({ x: headX + 2.8, y: headY - 0.8, w: 0.8, h: 1, fill: p.base });
  }

  // Stripes (Tiger)
  if (p.stripes) {
    const stripeXs = [4.5, 6.5, 8.5, 10.5];
    for (const sx of stripeXs) blocks.push({ x: sx, y: bodyY, w: 0.7, h: p.bodyHeight, fill: p.accent, opacity: 0.85 });
  }

  // Eye
  blocks.push({ x: headX + 2.7, y: headY + 1.1, w: 0.9, h: 0.9, fill: "#F8F7FC" });
  blocks.push({ x: headX + 2.95, y: headY + 1.3, w: 0.5, h: 0.5, fill: "#111118" });

  return blocks;
}

function buildSnakeBlocks(detailLevel: 1 | 2 | 3 | 4): PixelBlock[] {
  const base = "#34D399";
  const shade = "#1F8F68";
  const accent = "#0B3B2A";
  const blocks: PixelBlock[] = [];
  const segs = [
    { x: 1, y: 8, w: 2.4, h: 2 },
    { x: 3, y: 7, w: 2.4, h: 2.2 },
    { x: 5.2, y: 6, w: 2.4, h: 2.4 },
    { x: 7.4, y: 6.6, w: 2.4, h: 2.2 },
    { x: 9.6, y: 7.6, w: 2.4, h: 2 },
    { x: 11.8, y: 6.6, w: 2.6, h: 2 },
  ];
  for (const s of segs) blocks.push({ x: s.x, y: s.y, w: s.w, h: s.h, fill: base });
  // Belly pattern
  for (let i = 0; i < segs.length; i += 2) {
    const s = segs[i];
    blocks.push({ x: s.x + 0.5, y: s.y + s.h - 0.6, w: s.w - 1, h: 0.6, fill: shade, opacity: 0.7 });
  }
  // Head
  blocks.push({ x: 13.6, y: 6.2, w: 2, h: 2, fill: base });
  blocks.push({ x: 15.4, y: 6.6, w: 1, h: 0.5, fill: accent }); // tongue base
  if (detailLevel >= 2) blocks.push({ x: 16, y: 6.4, w: 0.8, h: 0.3, fill: accent });
  blocks.push({ x: 14.9, y: 6.6, w: 0.7, h: 0.7, fill: "#F8F7FC" });
  blocks.push({ x: 15.05, y: 6.75, w: 0.4, h: 0.4, fill: "#111118" });
  return blocks;
}

function buildEagleBlocks(detailLevel: 1 | 2 | 3 | 4): PixelBlock[] {
  const base = "#C8A46B";
  const shade = "#8A6C41";
  const accent = "#F8F7FC";
  const beak = "#FACC15";
  const blocks: PixelBlock[] = [];
  // Wings
  const wingSpread = detailLevel >= 3 ? 1 : 0.5;
  blocks.push({ x: 1 - wingSpread, y: 5, w: 4, h: 1.2, fill: shade });
  blocks.push({ x: 0 - wingSpread, y: 6.2, w: 5, h: 1.2, fill: base });
  blocks.push({ x: 11 + wingSpread, y: 5, w: 4, h: 1.2, fill: shade });
  blocks.push({ x: 11 + wingSpread, y: 6.2, w: 5, h: 1.2, fill: base });
  // Body
  blocks.push({ x: 6, y: 5.5, w: 4, h: 4, fill: accent });
  blocks.push({ x: 6, y: 9, w: 4, h: 1, fill: base });
  // Head
  blocks.push({ x: 6.4, y: 3, w: 3.2, h: 3, fill: base });
  // Beak
  blocks.push({ x: 9.6, y: 4.2, w: 1.2, h: 0.8, fill: beak });
  // Talons
  blocks.push({ x: 6.6, y: 10, w: 0.8, h: 1, fill: beak });
  blocks.push({ x: 8.6, y: 10, w: 0.8, h: 1, fill: beak });
  // Eye
  blocks.push({ x: 8, y: 3.8, w: 0.8, h: 0.8, fill: "#111118" });
  return blocks;
}

/** Stage 4 gets a soft aura ring behind the creature -- the "besonders hochwertige"
 * finishing touch called for at the final evolution stage. */
function auraBlocks(accent: string, cols: number, rows: number): PixelBlock[] {
  return [
    { x: 0, y: 0, w: cols, h: rows, fill: accent, opacity: 0.08 },
    { x: 1, y: 1, w: cols - 2, h: rows - 2, fill: accent, opacity: 0.06 },
  ];
}

export function petSpriteBlocks(species: PetSpecies, stage: 1 | 2 | 3 | 4): { blocks: PixelBlock[]; cols: number; rows: number } {
  const cols = 18;
  const rows = 12;
  let blocks: PixelBlock[];
  let accent = "#A855F7";

  if (species === "SNAKE") {
    blocks = buildSnakeBlocks(stage);
    accent = "#34D399";
  } else if (species === "EAGLE") {
    blocks = buildEagleBlocks(stage);
    accent = "#C8A46B";
  } else {
    const p = QUADRUPED_PARAMS[species];
    blocks = buildQuadrupedBlocks(p, stage);
    accent = p.accent;
  }

  // Scale factor by stage: younger stages render smaller/centered, older stages fill more
  // of the canvas -- gives an immediate "it grew" read without needing new geometry.
  const scale = { 1: 0.72, 2: 0.84, 3: 0.94, 4: 1.05 }[stage];
  const offsetX = (cols - cols * scale) / 2 + (scale < 1 ? 1 : -0.5);
  const offsetY = rows - rows * scale - (scale < 1 ? 0.5 : -0.3);
  const scaled = blocks.map((b) => ({ ...b, x: b.x * scale + offsetX, y: b.y * scale + offsetY, w: b.w * scale, h: b.h * scale }));

  const result = stage === 4 ? [...auraBlocks(accent, cols, rows), ...scaled] : scaled;
  return { blocks: result, cols, rows };
}

export function PetSprite({ species, stage, className, title }: { species: PetSpecies; stage: 1 | 2 | 3 | 4; className?: string; title?: string }) {
  const { blocks, cols, rows } = petSpriteBlocks(species, stage);
  return <PixelCanvas blocks={blocks} cols={cols} rows={rows} className={className} title={title} />;
}
