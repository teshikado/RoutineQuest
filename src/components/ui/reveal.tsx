"use client";

import { Children, isValidElement } from "react";
import { motion } from "framer-motion";

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
 * on re-scroll). Always renders the same `motion.div` element regardless of the user's
 * motion preference — reduced motion is handled centrally by the `MotionConfig` in
 * Providers, not by branching to a different element here (that branching previously
 * caused a real bug: `useReducedMotion()` can resolve differently between the server
 * render and the client's first paint, which is a hydration mismatch that left whole
 * sections — e.g. the login page — stuck invisible for reduced-motion users).
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
  const offset = DIRECTIONS[direction];

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
