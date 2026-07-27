"use client";

import clsx from "clsx";
import { EntryCard } from "./entry-card";
import { WEEKDAY_LABELS_LONG } from "@/lib/constants";
import { intervalsOverlap } from "@/lib/dayplan-client-utils";
import type { DayPlanEntryDTO } from "@/lib/dayplan-types";

export function WeekView({
  days,
  entriesByDay,
  todayKey,
  onToggle,
  onEdit,
  onMoveToDay,
  onSelectDay,
}: {
  days: { key: string; weekday: number; dayOfMonth: number }[];
  entriesByDay: Record<string, DayPlanEntryDTO[]>;
  todayKey: string;
  onToggle: (id: string) => void;
  onEdit: (entry: DayPlanEntryDTO) => void;
  onMoveToDay: (entry: DayPlanEntryDTO, dateKey: string) => void;
  onSelectDay: (dateKey: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 overflow-x-auto">
      {days.map((day) => {
        const dayEntries = (entriesByDay[day.key] ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
        const done = dayEntries.filter((e) => e.status === "DONE").length;
        const total = dayEntries.length;
        const ratio = total > 0 ? done / total : 0;
        const isToday = day.key === todayKey;

        const overlapIds = new Set<string>();
        for (let i = 0; i < dayEntries.length; i++) {
          for (let j = i + 1; j < dayEntries.length; j++) {
            if (intervalsOverlap(dayEntries[i].startTime, dayEntries[i].endTime, dayEntries[j].startTime, dayEntries[j].endTime)) {
              overlapIds.add(dayEntries[i].id);
              overlapIds.add(dayEntries[j].id);
            }
          }
        }

        return (
          <div
            key={day.key}
            className={clsx(
              "rounded-2xl border p-2.5 min-h-[160px] flex flex-col gap-2 transition-colors",
              isToday ? "border-[#A855F7] bg-[#171720] shadow-[0_0_0_1px_rgba(168,85,247,0.35)]" : "border-[#292936] bg-[#111118]"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const entryId = e.dataTransfer.getData("text/dayplan-entry-id");
              const found = Object.values(entriesByDay).flat().find((x) => x.id === entryId);
              if (found) onMoveToDay(found, day.key);
            }}
          >
            <button onClick={() => onSelectDay(day.key)} className="flex items-center justify-between text-left">
              <span className={clsx("text-xs font-bold", isToday ? "text-[#A855F7]" : "text-[#C8C5D2]")}>
                {WEEKDAY_LABELS_LONG[day.weekday].slice(0, 2)} {day.dayOfMonth}.
              </span>
              {total > 0 && <span className="text-[10px] text-[#8D8998] tabular-nums">{Math.round(ratio * 100)}%</span>}
            </button>

            {total > 0 && (
              <div className="h-1 rounded-full bg-[#292936] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#A855F7] to-[#34D399] transition-all duration-500" style={{ width: `${ratio * 100}%` }} />
              </div>
            )}

            <div className="flex-1 space-y-1.5">
              {dayEntries.length === 0 ? (
                <p className="text-[11px] text-[#5F5B68] py-2">Frei</p>
              ) : (
                dayEntries.map((entry) => (
                  <div key={entry.id} className={clsx(overlapIds.has(entry.id) && "ring-1 ring-[#FB7185] rounded-xl")}>
                    <EntryCard
                      entry={entry}
                      compact
                      dense
                      onToggle={onToggle}
                      onEdit={onEdit}
                      draggable
                      onDragStart={(e, en) => e.dataTransfer.setData("text/dayplan-entry-id", en.id)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
