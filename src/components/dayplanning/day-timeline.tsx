"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { EntryCard, type ContinuationSegment } from "./entry-card";
import { entryDateKey } from "@/lib/dayplan-types";
import type { DayPlanEntryDTO } from "@/lib/dayplan-types";

const HOUR_HEIGHT = 64; // px per hour
const TOTAL_HEIGHT = HOUR_HEIGHT * 24;
const SNAP_MINUTES = 15;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(min: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, min));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Current wall-clock minutes-since-midnight in Europe/Berlin, independent of the browser's
 * own timezone (mirrors the Intl-based approach in src/lib/dates.ts). */
function berlinNowMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  return Number(map.hour) * 60 + Number(map.minute);
}

type PositionedEntry = { entry: DayPlanEntryDTO; segment: ContinuationSegment; startMinutes: number; endMinutes: number };

export function DayTimeline({
  entries,
  selectedDateKey,
  isToday,
  onToggle,
  onEdit,
  onCreateAt,
  onMove,
  onDuplicate,
  onDelete,
}: {
  /** All entries touching this day OR the day before/after (so both halves of an overnight
   * block are available) -- filtering/splitting into segments happens inside this component. */
  entries: DayPlanEntryDTO[];
  selectedDateKey: string;
  isToday: boolean;
  onToggle: (id: string) => void;
  onEdit: (entry: DayPlanEntryDTO) => void;
  onCreateAt: (startTime: string) => void;
  onMove: (entry: DayPlanEntryDTO, newStartTime: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const [dragOverMinute, setDragOverMinute] = useState<number | null>(null);
  const scrolledRef = useRef(false);
  // Recomputed directly during render (not stored in state) so the tick interval below is the
  // only thing driving re-renders -- avoids calling setState synchronously inside the effect.
  const nowMinutes = isToday ? berlinNowMinutes() : null;

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [isToday]);

  useEffect(() => {
    if (scrolledRef.current || !containerRef.current) return;
    const target = nowMinutes ?? 6 * 60;
    containerRef.current.scrollTop = Math.max(0, (target / 1440) * TOTAL_HEIGHT - 160);
    scrolledRef.current = true;
  }, [nowMinutes]);

  const hours = useMemo(() => Array.from({ length: 25 }, (_, i) => i), []);

  // Split each entry into the segment(s) that fall on `selectedDateKey`: a same-day block
  // renders once ("full"); an overnight block renders as "start" (startTime->24:00) on its
  // start day and "end" (00:00->endTime) on its end day -- both from the SAME row/id, never
  // duplicated in the database, just displayed twice at most.
  const positioned = useMemo<PositionedEntry[]>(() => {
    const result: PositionedEntry[] = [];
    for (const entry of entries) {
      const startKey = entryDateKey(entry.date);
      const endKey = entryDateKey(entry.endDate);
      if (startKey === endKey && startKey === selectedDateKey) {
        result.push({ entry, segment: "full", startMinutes: timeToMinutes(entry.startTime), endMinutes: timeToMinutes(entry.endTime) });
      } else if (startKey === selectedDateKey) {
        result.push({ entry, segment: "start", startMinutes: timeToMinutes(entry.startTime), endMinutes: 24 * 60 });
      } else if (endKey === selectedDateKey) {
        result.push({ entry, segment: "end", startMinutes: 0, endMinutes: timeToMinutes(entry.endTime) });
      }
    }
    return result;
  }, [entries, selectedDateKey]);

  const overlapIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i];
        const b = positioned[j];
        if (a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
          ids.add(a.entry.id);
          ids.add(b.entry.id);
        }
      }
    }
    return ids;
  }, [positioned]);

  function minuteFromClientY(clientY: number): number {
    const rect = containerRef.current!.getBoundingClientRect();
    const y = clientY - rect.top + containerRef.current!.scrollTop;
    const raw = (y / TOTAL_HEIGHT) * 1440;
    return Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
  }

  function handleTrackClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-entry-card]")) return;
    const minute = minuteFromClientY(e.clientY);
    onCreateAt(minutesToTime(Math.max(0, Math.min(23 * 60 + 45, minute))));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOverMinute(minuteFromClientY(e.clientY));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const entryId = e.dataTransfer.getData("text/dayplan-entry-id");
    const found = positioned.find((x) => x.entry.id === entryId);
    setDragOverMinute(null);
    if (!found) return;
    const minute = minuteFromClientY(e.clientY);
    onMove(found.entry, minutesToTime(minute));
  }

  return (
    <div className="rounded-2xl bg-[#111118] border border-[#292936] overflow-hidden">
      <div ref={containerRef} className="relative overflow-y-auto max-h-[70vh] select-none" onDragOver={handleDragOver} onDrop={handleDrop}>
        <div className="relative flex" style={{ height: TOTAL_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 relative border-r border-[#1D1D28]">
            {hours.map((h) => (
              <div key={h} className="absolute left-0 right-0 text-right pr-2 text-[11px] text-[#8D8998] tabular-nums" style={{ top: h * HOUR_HEIGHT - 7 }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Track */}
          <div className="relative flex-1" onClick={handleTrackClick} role="presentation">
            {hours.map((h) => (
              <div key={h} className="absolute left-0 right-0 border-t border-[#1D1D28]" style={{ top: h * HOUR_HEIGHT }} />
            ))}

            {dragOverMinute !== null && (
              <div
                className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-[#A855F7] bg-[#A855F7]/10 pointer-events-none"
                style={{ top: (dragOverMinute / 1440) * TOTAL_HEIGHT, height: 40 }}
              />
            )}

            {nowMinutes !== null && (
              <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: (nowMinutes / 1440) * TOTAL_HEIGHT }}>
                <div className="relative h-0 border-t-2 border-[#C026FF] shadow-[0_0_8px_2px_rgba(192,38,255,0.6)]">
                  <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-[#C026FF] shadow-[0_0_10px_3px_rgba(192,38,255,0.7)]" />
                </div>
              </div>
            )}

            {positioned.map(({ entry, segment, startMinutes, endMinutes }) => {
              const top = (startMinutes / 1440) * TOTAL_HEIGHT;
              const height = Math.max(26, ((endMinutes - startMinutes) / 1440) * TOTAL_HEIGHT - 2);
              return (
                <motion.div
                  key={`${entry.id}-${segment}`}
                  data-entry-card
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-1 right-1 z-10"
                  style={{ top, height }}
                >
                  <EntryCard
                    entry={entry}
                    segment={segment}
                    dense={height < 44}
                    compact={height < 44}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                    draggable={segment !== "end"}
                    onDragStart={(e, en) => e.dataTransfer.setData("text/dayplan-entry-id", en.id)}
                    overlapping={overlapIds.has(entry.id)}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
