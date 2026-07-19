"use client";

import { useState } from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Undo2 } from "lucide-react";
import { DynamicIcon } from "@/components/ui/icon";
import { DIFFICULTY_META } from "@/lib/constants";
import type { Difficulty } from "@prisma/client";

export type TaskCardData = {
  routine: {
    id: string;
    title: string;
    description: string | null;
    icon: string;
    color: string;
    difficulty: Difficulty;
    timeOfDay: string | null;
  };
  completed: boolean;
  canUndo: boolean;
};

export function TaskCard({
  data,
  onToggle,
}: {
  data: TaskCardData;
  onToggle: (routineId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(false);
  const { routine, completed } = data;
  const meta = DIFFICULTY_META[routine.difficulty];

  async function handleToggle() {
    if (busy) return;
    setBusy(true);
    if (!completed) setBurst(true);
    await onToggle(routine.id);
    setBusy(false);
    setTimeout(() => setBurst(false), 900);
  }

  return (
    <div
      className={clsx(
        "relative flex items-center gap-4 rounded-2xl border p-4 transition-colors",
        completed ? "bg-[#F5FBF8] border-[#d6f0e5]" : "bg-white border-[#EAF7FC] shadow-[0_2px_12px_rgba(24,59,86,0.05)]"
      )}
    >
      <div
        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: routine.color + "22" }}
      >
        <DynamicIcon name={routine.icon} className="h-5 w-5" style={{ color: routine.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className={clsx("font-semibold text-[#183B56] truncate", completed && "line-through opacity-60")}>
          {routine.title}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#5b7a91] mt-0.5">
          <span>{meta.label}</span>
          <span>·</span>
          <span className="font-semibold" style={{ color: meta.color }}>
            +{meta.xp} XP
          </span>
          {routine.timeOfDay && (
            <>
              <span>·</span>
              <span>{routine.timeOfDay}</span>
            </>
          )}
        </div>
      </div>

      <div className="relative shrink-0">
        <AnimatePresence>
          {burst && (
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -30 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute -top-2 right-0 text-xs font-bold pointer-events-none"
              style={{ color: meta.color }}
            >
              +{meta.xp} XP
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleToggle}
          disabled={busy}
          aria-pressed={completed}
          aria-label={completed ? `${routine.title} als offen markieren` : `${routine.title} als erledigt markieren`}
          className={clsx(
            "h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all disabled:opacity-60",
            completed
              ? "bg-[#78D6B0] border-[#78D6B0] text-white scale-105"
              : "border-[#A7D8F0] text-transparent hover:bg-[#EAF7FC]"
          )}
        >
          <motion.span
            initial={false}
            animate={completed ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
          >
            <Check className="h-5 w-5" />
          </motion.span>
        </button>
      </div>

      {completed && data.canUndo && (
        <button
          onClick={handleToggle}
          disabled={busy}
          className="absolute -bottom-2 right-4 flex items-center gap-1 rounded-full bg-white border border-[#EAF7FC] px-2 py-0.5 text-[10px] font-semibold text-[#5b7a91] hover:text-[#4FA8D8] shadow-sm"
        >
          <Undo2 className="h-3 w-3" />
          Rückgängig
        </button>
      )}
    </div>
  );
}
