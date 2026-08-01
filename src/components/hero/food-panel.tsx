"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Drumstick } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MEAT_DAILY_GOAL, MEAT_FEED_AMOUNT, MEAT_VERY_FULL_THRESHOLD } from "@/lib/hero-constants";
import type { HeroPet } from "./hero-types";

export function FoodPanel({
  pet,
  meatBalance,
  todayMeat,
  onFeed,
}: {
  pet: HeroPet | null;
  meatBalance: number;
  todayMeat: number;
  onFeed: () => Promise<void>;
}) {
  const [feeding, setFeeding] = useState(false);
  const [burst, setBurst] = useState(false);

  const status = todayMeat >= MEAT_VERY_FULL_THRESHOLD ? "very-full" : todayMeat >= MEAT_DAILY_GOAL ? "full" : "hungry";
  const canFeed = pet !== null && meatBalance >= MEAT_FEED_AMOUNT;

  async function handleFeed() {
    setFeeding(true);
    try {
      await onFeed();
      setBurst(true);
      setTimeout(() => setBurst(false), 900);
    } finally {
      setFeeding(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[#F8F7FC]">Futter</h2>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-[#FACC15]">
          <Drumstick className="h-4 w-4" />
          Fleisch: {meatBalance.toLocaleString("de-DE")}
        </div>
      </div>

      {!pet ? (
        <p className="text-sm text-[#C8C5D2]">Wähle zuerst ein Haustier, um es füttern zu können.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs font-semibold text-[#C8C5D2]">
              <span>Heutige Fütterung</span>
              <span className="tabular-nums">
                {Math.min(todayMeat, MEAT_DAILY_GOAL)} / {MEAT_DAILY_GOAL} Fleisch{todayMeat >= MEAT_DAILY_GOAL ? " – Satt" : ""}
              </span>
            </div>
            <ProgressBar
              ratio={Math.min(1, todayMeat / MEAT_DAILY_GOAL)}
              gradient={status === "hungry" ? "linear-gradient(90deg, #FB7185, #FACC15)" : "linear-gradient(90deg, #34D399, #A855F7)"}
            />
          </div>

          <div
            className={`rounded-xl border p-3 text-sm flex items-center gap-2 ${
              status === "hungry" ? "border-[#3B1420] bg-[#3B1420]/40 text-[#FB7185]" : "border-[#0B3B2A] bg-[#0B3B2A]/40 text-[#34D399]"
            }`}
          >
            {status === "hungry" && "Dein Haustier braucht noch Fleisch."}
            {status === "full" && "Dein Haustier ist heute satt."}
            {status === "very-full" && "Dein Haustier ist heute besonders satt!"}
          </div>

          <div className="relative inline-block">
            <Button onClick={handleFeed} loading={feeding} disabled={!canFeed}>
              {MEAT_FEED_AMOUNT} Fleisch füttern
            </Button>
            {burst && (
              <motion.span
                initial={{ opacity: 1, y: 0, scale: 0.8 }}
                animate={{ opacity: 0, y: -20, scale: 1.1 }}
                transition={{ duration: 0.8 }}
                className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-bold text-[#34D399]"
              >
                +{MEAT_FEED_AMOUNT} zufrieden
              </motion.span>
            )}
          </div>
          {!canFeed && meatBalance < MEAT_FEED_AMOUNT && (
            <p className="text-xs text-[#8D8998]">Du hast nicht genug Fleisch. Schließe Aufgaben ab, um mehr zu verdienen.</p>
          )}
        </div>
      )}
    </Card>
  );
}
