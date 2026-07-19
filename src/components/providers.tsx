"use client";

import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import { ToastProvider } from "@/components/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* Framer Motion's own SSR-safe reduced-motion handling: disables transform/scale
          animations for prefers-reduced-motion users but keeps short opacity fades, without
          any server/client branching in individual components (which risks hydration
          mismatches — components must never render different element trees based on
          useReducedMotion(), since that value can differ between the server render and the
          client's first paint). */}
      <MotionConfig reducedMotion="user">
        <ToastProvider>{children}</ToastProvider>
      </MotionConfig>
    </SessionProvider>
  );
}
