"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Soft cross-fade + upward slide between routes. Navigation chrome (sidebar, topbar,
 * bottom nav) lives outside this wrapper so it never re-animates on page change.
 * Reduced motion is handled centrally by the `MotionConfig` in Providers (see Reveal.tsx
 * for why this component doesn't branch on useReducedMotion() itself).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
