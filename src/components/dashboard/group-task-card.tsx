"use client";

import { useState } from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Undo2 } from "lucide-react";
import { DynamicIcon } from "@/components/ui/icon";

export type GroupTaskCardData = {
  groupRoutine: {
    id: string;
    title: string;
    description: string | null;
    icon: string;
    color: string;
    xpReward: number;
    timeOfDay: string | null;
  };
  group: { id: string; name: string; icon: string; color: string };
  completed: boolean;
  canUndo: boolean;
};

export function GroupTaskCard({
  data,
  onToggle,
}: {
  data: GroupTaskCardData;
  onToggle: (groupRoutineId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(false);
  const { groupRoutine, group, completed } = data;

  async function handleToggle() {
    if (busy) return;
    setBusy(true);
    if (!completed) setBurst(true);
    await onToggle(groupRoutine.id);
    setBusy(false);
    setTimeout(() => setBurst(false), 900);
  }

  return (
    <div
      className={clsx(
        "relative flex items-center gap-4 rounded-2xl border p-4 transition-colors",
        completed ? "bg-[#10241C] border-[#1F6B4A]" : "bg-[#111118] border-[#292936] shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
      )}
    >
      <div
        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: groupRoutine.color + "22" }}
      >
        <DynamicIcon name={groupRoutine.icon} className="h-5 w-5" style={{ color: groupRoutine.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx("font-semibold text-[#F8F7FC] truncate", completed && "line-through opacity-60")}>
            {groupRoutine.title}
          </span>
          <span
            className="flex items-center gap-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 shrink-0"
            style={{ backgroundColor: group.color + "1a", color: group.color }}
          >
            <DynamicIcon name={group.icon} className="h-2.5 w-2.5" />
            {group.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#C8C5D2] mt-0.5">
          <span className="font-semibold" style={{ color: "#FACC15" }}>
            +{groupRoutine.xpReward} XP
          </span>
          {groupRoutine.timeOfDay && (
            <>
              <span>·</span>
              <span>{groupRoutine.timeOfDay}</span>
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
              style={{ color: "#FACC15" }}
            >
              +{groupRoutine.xpReward} XP
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleToggle}
          disabled={busy}
          aria-pressed={completed}
          aria-label={completed ? `${groupRoutine.title} als offen markieren` : `${groupRoutine.title} als erledigt markieren`}
          className={clsx(
            "h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all disabled:opacity-60",
            completed
              ? "bg-[#34D399] border-[#34D399] text-white scale-105"
              : "border-[#D8B4FE] text-transparent hover:bg-[#171720]"
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
          className="absolute -bottom-2 right-4 flex items-center gap-1 rounded-full bg-[#111118] border border-[#292936] px-2 py-0.5 text-[10px] font-semibold text-[#C8C5D2] hover:text-[#A855F7] shadow-sm"
        >
          <Undo2 className="h-3 w-3" />
          Rückgängig
        </button>
      )}
    </div>
  );
}
