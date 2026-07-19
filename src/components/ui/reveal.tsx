"use client";

import { Children, isValidElement } from "react";
import { motion, useReducedMotion } from "framer-motion";

const DIRECTIONS = {
  up: { x: 0, y: 18 },
  down: { x: 0, y: -18 },
  left: { x: 18, y: 0 },
  right: { x: -18, y: 0 },
  scale: { x: 0, y: 0 },
} as const;

type Direction = keyof typeof DIRECTIONS;

/**
 * Fades/slides a section in the moment it scrolls into view (once — it never re-triggers
 * on re-scroll). Falls back to a plain, unanimated wrapper for prefers-reduced-motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
  amount = 0.2,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: Direction;
  amount?: number;
}) {
  const reduceMotion = useReducedMotion();
  const offset = DIRECTIONS[direction];

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: offset.x, y: offset.y, scale: direction === "scale" ? 0.96 : 1 }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Wraps a list of cards (e.g. a grid of routine/group cards) and staggers each child's
 * Reveal by a small delay, so a grid appears to cascade in rather than pop all at once.
 * Drop-in: just wrap the existing list markup, no changes needed to the children themselves.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.07,
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  direction?: Direction;
}) {
  const items = Children.toArray(children);
  return (
    <div className={className}>
      {items.map((child, i) => (
        <Reveal
          key={isValidElement(child) && child.key != null ? child.key : i}
          delay={Math.min(i * stagger, 0.5)}
          direction={direction}
          amount={0.1}
        >
          {child}
        </Reveal>
      ))}
    </div>
  );
}
