"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const COLORS = ["#4FA8D8", "#78D6B0", "#FFD166", "#FF8A80", "#A7D8F0"];

type Piece = { id: number; left: number; delay: number; duration: number; size: number; color: string; drift: number };

function randomPieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 6 + Math.random() * 88,
    delay: Math.random() * 0.25,
    duration: 1 + Math.random() * 0.6,
    size: 5 + Math.random() * 5,
    color: COLORS[i % COLORS.length],
    drift: (Math.random() - 0.5) * 60,
  }));
}

/**
 * Lightweight, dependency-free confetti burst (no confetti library needed — a handful of
 * absolutely-positioned motion spans). Reserved for special moments: level up, new rank,
 * perfect week, finished group routine. Renders nothing for prefers-reduced-motion.
 */
export function Confetti({ active, pieces = 22 }: { active: boolean; pieces?: number }) {
  const reduceMotion = useReducedMotion();
  const [bits, setBits] = useState<Piece[]>([]);

  useEffect(() => {
    // Randomizing on activation (not during render) is the whole point here — each burst
    // should look different — so this intentionally lives in an effect, not useMemo.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot randomized burst triggered by `active` becoming true, not a render-derivable value
    if (active) setBits(randomPieces(pieces));
  }, [active, pieces]);

  if (!active || reduceMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {bits.map((b) => (
        <motion.span
          key={b.id}
          initial={{ y: -12, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 200, x: b.drift, opacity: 0, rotate: 300 }}
          transition={{ duration: b.duration, delay: b.delay, ease: "easeIn" }}
          style={{
            position: "absolute",
            left: `${b.left}%`,
            top: 0,
            width: b.size,
            height: b.size * 1.6,
            background: b.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
