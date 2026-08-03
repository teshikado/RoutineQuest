import sharp from "sharp";

/** Minimal raw-RGBA pixel buffer wrapper used by every generator script in this directory.
 * Deliberately low-level (no vector/antialiasing primitives) so every pixel written is an
 * exact, deterministic, opaque-or-transparent color -- matching the flat pixel-art style of
 * the rest of the hero asset set instead of producing soft/antialiased edges. */
export type Canvas = { width: number; height: number; data: Uint8ClampedArray };
export type RGBA = [number, number, number, number];

export function createCanvas(width: number, height: number): Canvas {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export async function loadCanvas(path: string): Promise<Canvas> {
  const img = sharp(path).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
}

export async function saveCanvas(canvas: Canvas, path: string): Promise<void> {
  await sharp(Buffer.from(canvas.data), { raw: { width: canvas.width, height: canvas.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(path);
}

export function cloneCanvas(c: Canvas): Canvas {
  return { width: c.width, height: c.height, data: new Uint8ClampedArray(c.data) };
}

export function inBounds(c: Canvas, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < c.width && y < c.height;
}

export function getPixel(c: Canvas, x: number, y: number): RGBA {
  if (!inBounds(c, x, y)) return [0, 0, 0, 0];
  const i = (y * c.width + x) * 4;
  return [c.data[i], c.data[i + 1], c.data[i + 2], c.data[i + 3]];
}

export function setPixel(c: Canvas, x: number, y: number, color: RGBA): void {
  if (!inBounds(c, x, y)) return;
  const i = (y * c.width + x) * 4;
  c.data[i] = color[0];
  c.data[i + 1] = color[1];
  c.data[i + 2] = color[2];
  c.data[i + 3] = color[3];
}

/** Alpha-composites `src` over `dst` at (x,y) using standard "over" blending -- used to layer
 * procedurally drawn hair/armor art onto an existing base without hard-replacing pixels at
 * the silhouette edge (keeps a clean 1px anti-fringe against the pixel-art edges below). */
export function blendPixel(c: Canvas, x: number, y: number, color: RGBA): void {
  if (!inBounds(c, x, y)) return;
  const [sr, sg, sb, sa] = color;
  if (sa <= 0) return;
  if (sa >= 255) return setPixel(c, x, y, color);
  const [dr, dg, db, da] = getPixel(c, x, y);
  const a = sa / 255;
  const outA = sa + da * (1 - a);
  const outR = sr * a + dr * (1 - a);
  const outG = sg * a + dg * (1 - a);
  const outB = sb * a + db * (1 - a);
  setPixel(c, x, y, [outR, outG, outB, outA]);
}

export function fillRect(c: Canvas, x0: number, y0: number, w: number, h: number, color: RGBA, blend = false): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) (blend ? blendPixel : setPixel)(c, x, y, color);
}

/** Fills every pixel in `points` (already-computed coordinates) with `color`. Kept separate
 * from shape-generation helpers so callers can build silhouettes with arbitrary per-row logic
 * (see rowSilhouette below) and still get consistent, deterministic pixel-exact fills. */
export function fillPoints(c: Canvas, points: [number, number][], color: RGBA, blend = false): void {
  for (const [x, y] of points) (blend ? blendPixel : setPixel)(c, x, y, color);
}

/** Draws a horizontally-symmetric silhouette band: for each row y in [y0, y0+h), fills columns
 * [centerX - halfWidth(rowT), centerX + halfWidth(rowT)) where rowT is the 0..1 progress
 * through the band. `halfWidth` typically comes from a small keyframe profile (see profile()
 * below) so a caller can describe a shape ("narrow at top, wide at shoulders, narrow at
 * wrists") without hand-writing per-row math each time. */
export function rowSilhouette(
  c: Canvas,
  y0: number,
  h: number,
  centerX: number,
  halfWidth: (t: number) => number,
  color: (t: number, dx: number) => RGBA,
  blend = true
): void {
  for (let row = 0; row < h; row++) {
    const t = h <= 1 ? 0 : row / (h - 1);
    const hw = Math.max(0, Math.round(halfWidth(t)));
    const y = y0 + row;
    for (let dx = -hw; dx <= hw; dx++) {
      const col = color(t, dx / Math.max(1, hw));
      if (col[3] > 0) (blend ? blendPixel : setPixel)(c, centerX + dx, y, col);
    }
  }
}

/** Piecewise-linear interpolation over a small set of (t, value) keyframes -- the shorthand
 * every shape/profile function in the generator scripts is built from. */
export function profile(keyframes: [number, number][]): (t: number) => number {
  return (t: number) => {
    if (t <= keyframes[0][0]) return keyframes[0][1];
    for (let i = 1; i < keyframes.length; i++) {
      const [t0, v0] = keyframes[i - 1];
      const [t1, v1] = keyframes[i];
      if (t <= t1) {
        const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * f;
      }
    }
    return keyframes[keyframes.length - 1][1];
  };
}

export function hexToRgba(hex: string, alpha = 255): RGBA {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b, alpha];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Shifts a color's hue/saturation to a target while keeping its original lightness (per pixel)
 * -- reuses the technique already proven for hair-color recolors this session: this preserves
 * whatever shadow/base/highlight shading structure the source pixel had instead of flattening
 * it into one flat tint. */
export function remapHueSat(rgb: RGBA, targetHue: number, satMul: number, lightMul = 1): RGBA {
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  void h;
  const [r, g, b] = hslToRgb(targetHue, Math.min(1, s * satMul + (satMul > 1 ? 0.1 : 0)), Math.min(1, Math.max(0, l * lightMul)));
  return [r, g, b, rgb[3]];
}

/** Pairwise pixel-diff hair mask: given two whole-body renders that differ ONLY in hair color
 * (same skin tone, same style), any pixel whose color differs beyond `threshold` between the
 * two must belong to the hair (skin/clothing are identical across hair-color variants). Used
 * to isolate the existing baked-in hairline so it can be neutralized before drawing a new
 * hairstyle overlay on top, and to build the bald body-build base. */
export function diffMask(a: Canvas, b: Canvas, threshold = 20, restrictTopFraction = 0.4): boolean[] {
  const mask = new Array(a.width * a.height).fill(false);
  const maxY = Math.floor(a.height * restrictTopFraction);
  for (let y = 0; y < maxY; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = y * a.width + x;
      const pa = getPixel(a, x, y);
      const pb = getPixel(b, x, y);
      if (pa[3] === 0 && pb[3] === 0) continue;
      const dist = Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]) + Math.abs(pa[2] - pb[2]) + Math.abs(pa[3] - pb[3]);
      if (dist > threshold) mask[i] = true;
    }
  }
  return mask;
}

export function dilateMask(mask: boolean[], width: number, height: number, radius = 1): boolean[] {
  const out = new Array(mask.length).fill(false);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = false;
      for (let dy = -radius; dy <= radius && !hit; dy++) {
        for (let dx = -radius; dx <= radius && !hit; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx]) hit = true;
        }
      }
      out[y * width + x] = hit;
    }
  }
  return out;
}

/** Non-uniform per-row horizontal resample: each row y is stretched/compressed around
 * `centerX` by `rowScale(t)` using nearest-neighbor sampling (no antialiasing, matching the
 * hard pixel edges of the rest of the art). Unlike a single whole-image scale, this changes
 * proportions *between* rows -- e.g. widening the shoulder band while leaving the head and
 * waist band untouched -- which is what actually produces a different silhouette per body
 * build instead of a uniformly resized copy of the same figure. */
export function rowReshape(src: Canvas, centerX: number, rowScale: (t: number) => number): Canvas {
  const out = createCanvas(src.width, src.height);
  for (let y = 0; y < src.height; y++) {
    const t = y / (src.height - 1);
    const scale = rowScale(t);
    for (let x = 0; x < src.width; x++) {
      const srcX = Math.round(centerX + (x - centerX) / scale);
      setPixel(out, x, y, getPixel(src, srcX, y));
    }
  }
  return out;
}

/** Same idea as rowReshape, but clamps the per-row scale so the row's own opaque content
 * never gets pushed past `marginPx` from either canvas edge -- computed from the *actual*
 * measured content bounds of that exact row rather than a hand-picked keyframe, so a
 * silhouette can never clip off the fixed frame regardless of how aggressive the requested
 * widen factor is at that row (a wide "kraeftig" shoulder row and a narrow wrist row right
 * next to it get different effective scale automatically). Only widening (scale > 1) is
 * clamped; narrowing is always safe since it moves content inward. */
export function rowReshapeClamped(src: Canvas, centerX: number, rowScale: (t: number) => number, marginPx = 2): Canvas {
  const out = createCanvas(src.width, src.height);
  for (let y = 0; y < src.height; y++) {
    const t = y / (src.height - 1);
    const desired = rowScale(t);
    const bounds = findOpaqueBoundsRow(src, y);
    let scale = desired;
    if (bounds && desired > 1) {
      const [bx0, bx1] = bounds;
      const leftExtent = centerX - bx0;
      const rightExtent = bx1 - centerX;
      const maxLeft = leftExtent > 0 ? (centerX - marginPx) / leftExtent : Infinity;
      const maxRight = rightExtent > 0 ? (src.width - 1 - marginPx - centerX) / rightExtent : Infinity;
      scale = Math.max(1, Math.min(desired, maxLeft, maxRight));
    }
    for (let x = 0; x < src.width; x++) {
      const srcX = Math.round(centerX + (x - centerX) / scale);
      setPixel(out, x, y, getPixel(src, srcX, y));
    }
  }
  return out;
}

export function findOpaqueBoundsRow(c: Canvas, y: number): [number, number] | null {
  let left = -1, right = -1;
  for (let x = 0; x < c.width; x++) {
    if (getPixel(c, x, y)[3] > 10) {
      if (left === -1) left = x;
      right = x;
    }
  }
  return left === -1 ? null : [left, right];
}

export function findOpaqueBounds(c: Canvas): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    const row = findOpaqueBoundsRow(c, y);
    if (row) {
      x0 = Math.min(x0, row[0]);
      x1 = Math.max(x1, row[1]);
      y0 = Math.min(y0, y);
      y1 = y;
    }
  }
  return x1 === -1 ? null : { x0, y0, x1, y1 };
}
