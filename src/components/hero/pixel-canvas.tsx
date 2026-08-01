/** Renders a set of grid-aligned rectangles as one crisp pixel-art image. SVG geometry
 * (rather than a scaled-up raster image) is used deliberately: `<rect>` edges are always
 * pixel-sharp at any display size with no blur/anti-aliasing artifacts, so a small logical
 * grid (e.g. 16x16 "pixel" units) reads as clean pixel art whether it's rendered at 32px or
 * 320px. `shape-rendering="crispEdges"` reinforces that on renderers that would otherwise
 * try to smooth adjoining rect edges. */
export type PixelBlock = { x: number; y: number; w: number; h: number; fill: string; opacity?: number };

export function PixelCanvas({
  blocks,
  cols,
  rows,
  className,
  title,
}: {
  blocks: PixelBlock[];
  cols: number;
  rows: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      className={className}
      style={{ imageRendering: "pixelated", shapeRendering: "crispEdges" }}
      role={title ? "img" : "presentation"}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {blocks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill} opacity={b.opacity} />
      ))}
    </svg>
  );
}
