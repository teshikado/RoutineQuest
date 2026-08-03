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

/** Nearest-neighbor resize (no interpolation, matching this project's flat pixel-art style --
 * see the note on Canvas above). Used to place existing icon art onto a differently-sized
 * native character canvas before further per-row reshaping. */
export function resizeNearest(src: Canvas, width: number, height: number): Canvas {
  const out = createCanvas(width, height);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / width));
      setPixel(out, x, y, getPixel(src, sx, sy));
    }
  }
  return out;
}

/** Alpha-composites all of `src` onto `dst` at (ox, oy) using blendPixel. */
export function pasteInto(dst: Canvas, src: Canvas, ox: number, oy: number): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const p = getPixel(src, x, y);
      if (p[3] > 0) blendPixel(dst, ox + x, oy + y, p);
    }
  }
}

export function cropCanvas(c: Canvas, x0: number, y0: number, w: number, h: number): Canvas {
  const out = createCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPixel(out, x, y, getPixel(c, x0 + x, y0 + y));
  return out;
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

/** Recenters and rescales every row of `c` so its own opaque span converges on a target
 * half-width/center supplied per-row (typically measured from a *different* image, e.g. a real
 * body silhouette) -- unlike rowReshapeClamped (which widens/narrows by a hand-tuned curve),
 * this makes the row's rendered width match an externally measured target by construction,
 * which is what closes an armor-icon/body-silhouette gap for good instead of trial-and-error
 * box tuning.
 *
 * Both the source's own per-row bounds AND the target are smoothed with a moving average
 * (`smoothRadius`) before the per-row scale/center is computed -- detailed icon art (studs,
 * notches, overlapping plates) has much noisier row-to-row width than a body silhouette, and
 * reacting to every single-row dip/bulge with a fresh scale factor produces a rippling,
 * moire-like distortion instead of a clean conform (this was the actual failure mode the first,
 * unsmoothed version of this function had). Smoothing the *scale curve* while still resampling
 * the *raw* pixel row keeps the icon's real detail intact and only changes its overall taper.
 * Rows with no opaque content on either side are left untouched. `scaleClamp` bounds how
 * aggressively a very thin source row is stretched, so nothing balloons into a smear.
 * `marginPx` caps the desired half-width so the placed content can never be pushed past the
 * canvas edge around its own target center -- without this, a build whose measured body width
 * already sits close to the frame (by design, see rowReshapeClamped) plus the armor's own
 * outward padding could clip a real chunk of the armor off past the edge instead of merely
 * leaving a small gap, which is a worse visual defect than the one being fixed. */
export function conformRowsToTarget(
  c: Canvas,
  targetHalfWidthAt: (y: number) => number | null,
  targetCenterAt: (y: number) => number | null,
  paddingPx = 0,
  opts: { scaleClamp?: [number, number]; smoothRadius?: number; marginPx?: number } = {}
): Canvas {
  const { scaleClamp = [0.4, 2.5], smoothRadius = 7, marginPx = 3 } = opts;
  const h = c.height;
  const ownHalf: (number | null)[] = new Array(h).fill(null);
  const ownCenter: (number | null)[] = new Array(h).fill(null);
  const tgtHalf: (number | null)[] = new Array(h).fill(null);
  const tgtCenter: (number | null)[] = new Array(h).fill(null);
  for (let y = 0; y < h; y++) {
    const b = findOpaqueBoundsRow(c, y);
    if (b) {
      ownHalf[y] = (b[1] - b[0]) / 2;
      ownCenter[y] = (b[0] + b[1]) / 2;
    }
    tgtHalf[y] = targetHalfWidthAt(y);
    tgtCenter[y] = targetCenterAt(y);
  }
  const smooth = (arr: (number | null)[]): (number | null)[] => {
    const out: (number | null)[] = new Array(h).fill(null);
    for (let y = 0; y < h; y++) {
      let sum = 0, n = 0;
      for (let d = -smoothRadius; d <= smoothRadius; d++) {
        const v = arr[y + d];
        if (v !== undefined && v !== null) { sum += v; n++; }
      }
      out[y] = n > 0 ? sum / n : null;
    }
    return out;
  };
  const ownHalfS = smooth(ownHalf);
  const ownCenterS = smooth(ownCenter);
  const tgtHalfS = smooth(tgtHalf);
  const tgtCenterS = smooth(tgtCenter);

  const out = createCanvas(c.width, h);
  for (let y = 0; y < h; y++) {
    const oh = ownHalfS[y];
    const oc = ownCenterS[y];
    const th = tgtHalfS[y];
    const tc = tgtCenterS[y];
    if (oh === null || oc === null || th === null || tc === null) {
      for (let x = 0; x < c.width; x++) setPixel(out, x, y, getPixel(c, x, y));
      continue;
    }
    const desired = th + paddingPx;
    const rawScale = oh > 0.5 ? desired / oh : 1;
    let scale = Math.max(scaleClamp[0], Math.min(scaleClamp[1], rawScale));
    // Hard override, applied *after* scaleClamp: never let this row's *actual* (unsmoothed)
    // opaque content get pushed past the canvas edge, even if that means going below
    // scaleClamp's floor -- margin safety always wins. Using the smoothed half-width here
    // instead of the row's real own bounds was tried first and still let individual rows whose
    // raw content is wider than their smoothed estimate clip through, since the clamp was
    // checking a number smaller than what would actually get projected outward.
    const ownRaw = ownHalf[y] !== null && ownCenter[y] !== null ? { half: ownHalf[y]!, center: ownCenter[y]! } : null;
    if (ownRaw) {
      const leftExtent = oc - (ownRaw.center - ownRaw.half);
      const rightExtent = ownRaw.center + ownRaw.half - oc;
      if (leftExtent > 0.5) scale = Math.min(scale, (tc - marginPx) / leftExtent);
      if (rightExtent > 0.5) scale = Math.min(scale, (c.width - 1 - marginPx - tc) / rightExtent);
      scale = Math.max(0.05, scale);
    }
    for (let x = 0; x < c.width; x++) {
      const srcX = Math.round(oc + (x - tc) / scale);
      setPixel(out, x, y, getPixel(c, srcX, y));
    }
  }
  return out;
}

/** Background matting via adaptive flood fill from a set of seed points (normally the four
 * corners of a crop window, which are reliably background). Unlike a single fixed seed-color
 * threshold, each newly-accepted pixel is compared against the *local* already-accepted
 * neighbor average (not the original seed color) -- so a slow gradient/vignette background is
 * still walked correctly, while the creature's hard silhouette edge (a sharp jump vs. its
 * neighbors) stops the fill. Returns a boolean mask, true = background. */
export function floodFillBackground(c: Canvas, seeds: [number, number][], threshold = 22): boolean[] {
  const w = c.width, h = c.height;
  const mask = new Array(w * h).fill(false);
  const visited = new Array(w * h).fill(false);
  const queue: [number, number][] = [];
  for (const [sx, sy] of seeds) {
    const idx = sy * w + sx;
    if (!visited[idx]) {
      visited[idx] = true;
      mask[idx] = true;
      queue.push([sx, sy]);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    const [r, g, b] = getPixel(c, x, y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nidx = ny * w + nx;
      if (visited[nidx]) continue;
      const [nr, ng, nb] = getPixel(c, nx, ny);
      const dist = Math.abs(nr - r) + Math.abs(ng - g) + Math.abs(nb - b);
      if (dist <= threshold) {
        visited[nidx] = true;
        mask[nidx] = true;
        queue.push([nx, ny]);
      } else {
        visited[nidx] = true; // still mark visited so it isn't re-queued, but not background
      }
    }
  }
  return mask;
}

/** 4-connected components over "true" cells of a boolean mask (e.g. the pixels a background
 * flood-fill did NOT reach). Used to separate the intended creature from a disconnected
 * fragment of a neighboring grid cell that a generously-padded crop window picked up. */
export function connectedComponents(mask: boolean[], width: number, height: number): { pixels: [number, number][] }[] {
  const visited = new Array(mask.length).fill(false);
  const components: { pixels: [number, number][] }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx] || visited[idx]) continue;
      const pixels: [number, number][] = [];
      const queue: [number, number][] = [[x, y]];
      visited[idx] = true;
      let head = 0;
      while (head < queue.length) {
        const [cx, cy] = queue[head++];
        pixels.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nidx = ny * width + nx;
          if (mask[nidx] && !visited[nidx]) {
            visited[nidx] = true;
            queue.push([nx, ny]);
          }
        }
      }
      components.push({ pixels });
    }
  }
  return components;
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
