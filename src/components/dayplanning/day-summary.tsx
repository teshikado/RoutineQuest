"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { DAY_REVIEW_MOOD_META, DAYPLAN_ENTRY_XP } from "@/lib/dayplan-constants";
import { formatDurationLabel, durationMinutes } from "@/lib/dayplan-client-utils";
import { useToast } from "@/components/toast";
import type { DayPlanEntryDTO, DayReviewDTO } from "@/lib/dayplan-types";
import type { DayReviewMood } from "@prisma/client";

export function DayStatsBar({ entries }: { entries: DayPlanEntryDTO[] }) {
  const total = entries.length;
  const done = entries.filter((e) => e.status === "DONE").length;
  const skipped = entries.filter((e) => e.status === "SKIPPED").length;
  const open = total - done - skipped;
  const plannedMinutes = entries.reduce((sum, e) => sum + durationMinutes(e.startTime, e.endTime), 0);
  const freeMinutes = Math.max(0, 24 * 60 - plannedMinutes);
  const ratio = total > 0 ? done / total : 0;

  const busy = plannedMinutes > 10 * 60;
  const sorted = entries.slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
  let noBreaks = false;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const gapMinutes = durationMinutes(prev.endTime, cur.startTime);
    const prevLong = durationMinutes(prev.startTime, prev.endTime) >= 90;
    const curLong = durationMinutes(cur.startTime, cur.endTime) >= 90;
    if (gapMinutes <= 0 && prevLong && curLong) {
      noBreaks = true;
      break;
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-[#F8F7FC]">
          {done} von {total} geplanten Aufgaben erledigt
        </span>
        <span className="text-sm font-semibold text-[#A855F7] tabular-nums">{Math.round(ratio * 100)}%</span>
      </div>
      <ProgressBar ratio={ratio} className="mb-3" gradient="linear-gradient(90deg, #A855F7, #34D399)" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Stat label="Offen" value={open} />
        <Stat label="Übersprungen" value={skipped} />
        <Stat label="Verplant" value={formatDurationLabel(plannedMinutes)} />
        <Stat label="Frei" value={formatDurationLabel(freeMinutes)} />
      </div>
      {total > 0 && (busy || noBreaks) && (
        <p className="text-[11px] text-[#8D8998] mt-3">
          {busy && "Sehr voller Tag. "}
          {noBreaks && "Keine Pause zwischen zwei Aufgaben erkannt."}
        </p>
      )}
    </Card>
  );
}

export function DaySummaryReview({ dateKey, isPastOrToday }: { dateKey: string; isPastOrToday: boolean }) {
  const { showToast } = useToast();
  const [review, setReview] = useState<DayReviewDTO>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isPastOrToday) return;
    fetch(`/api/day-review?date=${dateKey}`)
      .then((r) => r.json())
      .then((data: DayReviewDTO) => {
        setReview(data);
        setNote(data?.note ?? "");
      });
  }, [dateKey, isPastOrToday]);

  async function saveMood(mood: DayReviewMood) {
    setSaving(true);
    const res = await fetch("/api/day-review", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateKey, mood, note }),
    });
    const data = await res.json();
    setReview(data);
    setSaving(false);
    showToast("Tagesbewertung gespeichert.", "success");
  }

  async function saveNote() {
    setSaving(true);
    const res = await fetch("/api/day-review", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateKey, mood: review?.mood ?? null, note }),
    });
    const data = await res.json();
    setReview(data);
    setSaving(false);
  }

  if (!isPastOrToday) return null;

  return (
    <Card>
      <h3 className="text-sm font-bold text-[#F8F7FC] mb-1">Wie war dein Tag?</h3>
      <p className="text-xs text-[#8D8998] mb-3">Diese Bewertung ist privat und wird niemandem angezeigt.</p>
      <div className="flex gap-2 flex-wrap mb-3">
        {(Object.entries(DAY_REVIEW_MOOD_META) as [DayReviewMood, (typeof DAY_REVIEW_MOOD_META)[DayReviewMood]][]).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => saveMood(key)}
            disabled={saving}
            aria-pressed={review?.mood === key}
            className={clsx(
              "rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors",
              review?.mood === key ? "border-[#A855F7] bg-[#171720] text-[#F8F7FC]" : "border-[#292936] text-[#C8C5D2] hover:bg-[#171720]"
            )}
          >
            <span>{meta.emoji}</span> {meta.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        maxLength={1000}
        rows={2}
        placeholder="Notiz zum Tag (optional)…"
        className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] placeholder:text-[#8D8998] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
      />
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-[#171720] px-2.5 py-2">
      <div className="text-[#F8F7FC] font-bold tabular-nums">{value}</div>
      <div className="text-[#8D8998]">{label}</div>
    </div>
  );
}

export { DAYPLAN_ENTRY_XP };
