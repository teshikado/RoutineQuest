"use client";

import clsx from "clsx";
import { Check, MapPin, Link2, Repeat } from "lucide-react";
import { DynamicIcon } from "@/components/ui/icon";
import { DAYPLAN_STATUS_META, DAYPLAN_PRIORITY_META } from "@/lib/dayplan-constants";
import type { DayPlanEntryDTO } from "@/lib/dayplan-types";

export function EntryCard({
  entry,
  compact = false,
  dense = false,
  onToggle,
  onEdit,
  draggable = false,
  onDragStart,
  overlapping = false,
}: {
  entry: DayPlanEntryDTO;
  compact?: boolean;
  dense?: boolean;
  onToggle: (id: string) => void;
  onEdit: (entry: DayPlanEntryDTO) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, entry: DayPlanEntryDTO) => void;
  overlapping?: boolean;
}) {
  const done = entry.status === "DONE";
  const skipped = entry.status === "SKIPPED";

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, entry)}
      className={clsx(
        "group relative rounded-xl border pl-3 pr-2 py-1.5 flex items-start gap-2 transition-all duration-200 ease-[var(--ease-out-soft)] cursor-pointer",
        done
          ? "bg-[#10241C] border-[#1F6B4A]"
          : skipped
          ? "bg-[#171720]/70 border-[#292936] opacity-60"
          : "bg-[#111118] border-[#292936] hover:border-[#3D2A5C] hover:-translate-y-0.5",
        overlapping && !done && "ring-1 ring-[#FB7185]",
        dense ? "min-h-[24px]" : "min-h-[44px]"
      )}
      style={{ borderLeftColor: entry.color, borderLeftWidth: 3 }}
      onClick={() => onEdit(entry)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <DynamicIcon name={entry.icon} className="h-3.5 w-3.5 shrink-0" style={{ color: entry.color }} />
          <span className={clsx("text-sm font-semibold text-[#F8F7FC] truncate", done && "line-through opacity-70")}>
            {entry.title}
          </span>
          {entry.seriesId && <Repeat className="h-3 w-3 text-[#8D8998] shrink-0" aria-label="Teil einer Wiederholung" />}
        </div>
        {!compact && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#C8C5D2] mt-0.5 flex-wrap">
            <span className="tabular-nums">
              {entry.startTime}–{entry.endTime}
            </span>
            {entry.priority !== "NORMAL" && (
              <span className="font-semibold" style={{ color: DAYPLAN_PRIORITY_META[entry.priority].color }}>
                {DAYPLAN_PRIORITY_META[entry.priority].label}
              </span>
            )}
            {entry.location && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin className="h-3 w-3" /> {entry.location}
              </span>
            )}
            {entry.link && <Link2 className="h-3 w-3" />}
            {skipped && <span className="text-[#8D8998]">{DAYPLAN_STATUS_META.SKIPPED.label}</span>}
          </div>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(entry.id);
        }}
        aria-pressed={done}
        aria-label={done ? `${entry.title} als offen markieren` : `${entry.title} als erledigt markieren`}
        className={clsx(
          "h-6 w-6 rounded-full flex items-center justify-center border-2 shrink-0 transition-all duration-200",
          done ? "bg-[#34D399] border-[#34D399] text-white" : "border-[#D8B4FE] text-transparent hover:bg-[#171720]"
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
