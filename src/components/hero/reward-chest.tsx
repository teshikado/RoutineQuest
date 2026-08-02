"use client";

import { motion } from "framer-motion";
import type { ItemRarity } from "@prisma/client";

/** A small pixel-grid chest, hand-authored here (not derived from any external asset) since
 * no chest art was among the provided sprite sheets. Each row is a string of one-character
 * codes mapped to a color below; rendered as crisp, unscaled `<rect>`s (`shapeRendering:
 * crispEdges`) so it reads as pixel art consistent with the rest of the hero system rather
 * than a smooth vector icon. Split into a lid and a base group so the lid can animate
 * separately during the opening sequence. */
const LID_ROWS = [
  "................",
  "...LLLLLLLLLL...",
  "..LLLLLLLLLLLL..",
  ".LLLLLLLLLLLLLL.",
  ".LLLLDDDDDDLLLL.",
  "MMMMMMMMMMMMMMMM",
];

const BASE_ROWS = [
  "BBBBBBBBBBBBBBBB",
  "BBBBBBKKKKBBBBBB",
  "BBBBBBKGGKBBBBBB",
  "BBBBBBKKKKBBBBBB",
  "BBBBBBBBBBBBBBBB",
  "MMMMMMMMMMMMMMMM",
  ".BBBBBBBBBBBBBB.",
  "..BBBBBBBBBBBB..",
];

type ChestPalette = { L: string; D: string; M: string; B: string; K: string; G: string };

const RARITY_PALETTE: Record<ItemRarity, ChestPalette> = {
  COMMON: { L: "#9CA3AF", D: "#6B7280", M: "#4B5563", B: "#57422E", K: "#2A2118", G: "#D1D5DB" },
  RARE: { L: "#60A5FA", D: "#2563EB", M: "#1E3A8A", B: "#3F3320", K: "#1A140C", G: "#BFDBFE" },
  EPIC: { L: "#C084FC", D: "#9333EA", M: "#581C87", B: "#3F3320", K: "#1A140C", G: "#F3E8FF" },
  LEGENDARY: { L: "#FDE047", D: "#EAB308", M: "#92400E", B: "#4A3820", K: "#1A140C", G: "#FEF9C3" },
};

const MILESTONE_PALETTE: ChestPalette = { L: "#D8B4FE", D: "#9333EA", M: "#FACC15", B: "#3F3320", K: "#1A140C", G: "#FEF9C3" };

function PixelGrid({ rows, palette, cell = 8 }: { rows: string[]; palette: ChestPalette; cell?: number }) {
  const width = rows[0].length * cell;
  const height = rows.length * cell;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" shapeRendering="crispEdges" style={{ overflow: "visible" }}>
      {rows.map((row, y) =>
        [...row].map((ch, x) => {
          if (ch === ".") return null;
          const color = palette[ch as keyof ChestPalette];
          if (!color) return null;
          return <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={color} />;
        })
      )}
    </svg>
  );
}

export function RewardChest({
  rarity,
  isMilestone,
  opened,
  reducedMotion,
  className,
}: {
  rarity: ItemRarity;
  isMilestone: boolean;
  opened: boolean;
  reducedMotion: boolean;
  className?: string;
}) {
  const palette = isMilestone ? MILESTONE_PALETTE : RARITY_PALETTE[rarity];
  const lidHeight = LID_ROWS.length * 8;

  return (
    <div className={`relative ${className ?? ""}`} style={{ aspectRatio: "16 / 14" }}>
      {opened && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 45%, ${palette.L}99, transparent 70%)` }}
          initial={reducedMotion ? { opacity: 0.7 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: reducedMotion ? 0.7 : [0, 1, 0.6], scale: reducedMotion ? 1 : [0.4, 1.3, 1.1] }}
          transition={{ duration: reducedMotion ? 0.2 : 0.7, ease: "easeOut" }}
        />
      )}
      <div className="absolute inset-x-0 bottom-0" style={{ height: `${(BASE_ROWS.length / (BASE_ROWS.length + LID_ROWS.length)) * 100}%` }}>
        <PixelGrid rows={BASE_ROWS} palette={palette} />
      </div>
      <motion.div
        className="absolute inset-x-0 top-0 origin-bottom"
        style={{ height: `${(lidHeight / ((BASE_ROWS.length + LID_ROWS.length) * 8)) * 100}%` }}
        animate={
          reducedMotion
            ? { rotate: opened ? -25 : 0, y: opened ? -4 : 0 }
            : opened
              ? { rotate: [-2, -30, -25], y: [0, -6, -4] }
              : { rotate: [0, -1.5, 0, 1.5, 0], y: 0 }
        }
        transition={opened ? { duration: 0.5, ease: "easeOut" } : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      >
        <PixelGrid rows={LID_ROWS} palette={palette} />
      </motion.div>
    </div>
  );
}
