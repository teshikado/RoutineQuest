"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { EntryCard } from "./entry-card";
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

export function DayTimeline({
  entries,
  isToday,
  onToggle,
  onEdit,
  onCreateAt,
  onMove,
}: {
  entries: DayPlanEntryDTO[];
  isToday: boolean;
  onToggle: (id: string) => void;
  onEdit: (entry: DayPlanEntryDTO) => void;
  onCreateAt: (startTime: string) => void;
  onMove: (entry: DayPlanEntryDTO, newStartTime: string) => void;
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

  const overlapIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.startTime < b.endTime && b.startTime < a.endTime) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [entries]);

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
    const entry = entries.find((x) => x.id === entryId);
    setDragOverMinute(null);
    if (!entry) return;
    const minute = minuteFromClientY(e.clientY);
    onMove(entry, minutesToTime(minute));
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

            {entries.map((entry) => {
              const start = timeToMinutes(entry.startTime);
              const end = timeToMinutes(entry.endTime);
              const top = (start / 1440) * TOTAL_HEIGHT;
              const height = Math.max(26, ((end - start) / 1440) * TOTAL_HEIGHT - 2);
              return (
                <motion.div
                  key={entry.id}
                  data-entry-card
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-1 right-1 z-10"
                  style={{ top, height }}
                >
                  <EntryCard
                    entry={entry}
                    dense={height < 44}
                    compact={height < 44}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    draggable
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
