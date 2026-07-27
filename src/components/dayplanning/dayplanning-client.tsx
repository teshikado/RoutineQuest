"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Plus, Zap, LayoutTemplate, CalendarClock, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyDayPlanIllustration } from "@/components/ui/illustrations";
import { useToast } from "@/components/toast";
import { DayTimeline } from "./day-timeline";
import { WeekView } from "./week-view";
import { ListView } from "./list-view";
import { EntryFormModal, type EntryFormValues } from "./entry-form-modal";
import { DayPlanWizardModal } from "./dayplan-wizard-modal";
import { QuickAddModal } from "./quick-add-modal";
import { TemplatesPanel } from "./templates-panel";
import { DayPlanManageModal } from "./dayplan-manage-modal";
import { DayStatsBar, DaySummaryReview } from "./day-summary";
import { dateKey, todayDateOnly, addDaysUtc, getWeekInfo, formatLongDateDe, parseDateKey, isoWeekday } from "@/lib/dates";
import { entryDateKey } from "@/lib/dayplan-types";
import { daySegmentsForEntry } from "@/lib/dayplan-client-utils";
import type { ContinuationSegment } from "./entry-card";
import type { DayPlanEntryDTO } from "@/lib/dayplan-types";

type View = "day" | "week" | "list";

function addMinutesClamped(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Combined (date, "HH:mm") -> minutes-since-epoch-day, mirroring the server-side helper in
 * dayplan-service.ts, used here only to roll a quick "+X minutes" move across midnight. */
function combinedMinutes(dateKeyStr: string, time: string): number {
  const days = new Date(`${dateKeyStr}T00:00:00.000Z`).getTime() / 86400000;
  const [h, m] = time.split(":").map(Number);
  return days * 1440 + h * 60 + m;
}
function fromCombinedMinutes(total: number): { date: string; time: string } {
  const days = Math.floor(total / 1440);
  const minutesOfDay = total - days * 1440;
  return {
    date: dateKey(new Date(days * 86400000)),
    time: `${String(Math.floor(minutesOfDay / 60)).padStart(2, "0")}:${String(minutesOfDay % 60).padStart(2, "0")}`,
  };
}

export function DayPlanningClient({ xpForDayPlanning }: { xpForDayPlanning: boolean }) {
  const { showToast } = useToast();
  const todayKey = dateKey(todayDateOnly());

  const [view, setView] = useState<View>("day");
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [entries, setEntries] = useState<DayPlanEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [entryModal, setEntryModal] = useState<{ entry?: DayPlanEntryDTO; date?: string; start?: string; end?: string } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [managePlanId, setManagePlanId] = useState<string | null>(null);

  const week = useMemo(() => getWeekInfo(parseDateKey(selectedDateKey)), [selectedDateKey]);

  const range = useMemo(() => {
    if (view === "day") return { start: selectedDateKey, end: selectedDateKey };
    if (view === "week") return { start: dateKey(week.start), end: dateKey(week.end) };
    const today = todayDateOnly();
    return { start: dateKey(addDaysUtc(today, -7)), end: dateKey(addDaysUtc(today, 30)) };
  }, [view, selectedDateKey, week]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dayplan-entries?start=${range.start}&end=${range.end}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    // Deferred so the fetch (which sets loading/entries state) isn't invoked synchronously
    // within the effect body itself.
    const id = setTimeout(fetchEntries, 0);
    return () => clearTimeout(id);
  }, [fetchEntries]);

  // ---------- Reminders (foreground only, permission requested on demand elsewhere) ----------
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = new Date();
    for (const entry of entries) {
      if (entry.reminderMinutes === null || entry.status === "DONE" || entry.status === "SKIPPED") continue;
      if (entryDateKey(entry.date) !== todayKey) continue;
      const [h, m] = entry.startTime.split(":").map(Number);
      const fireAt = new Date(now);
      fireAt.setHours(h, m - entry.reminderMinutes, 0, 0);
      const delay = fireAt.getTime() - now.getTime();
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        timers.push(
          setTimeout(() => {
            new Notification(entry.title, { body: `Beginnt um ${entry.startTime} Uhr`, icon: "/icon.png" });
          }, delay)
        );
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [entries, todayKey]);

  // Entries that TOUCH the selected day (start on it, end on it, or -- for the timeline --
  // both), used for the timeline's split "start"/"end" rendering.
  const dayTouchingEntries = useMemo(
    () => entries.filter((e) => entryDateKey(e.date) <= selectedDateKey && entryDateKey(e.endDate) >= selectedDateKey),
    [entries, selectedDateKey]
  );
  // Entries that BELONG to the selected day for progress/stats purposes -- a block counts
  // once, on its start day, never twice (see spec: "gehört der Zeitblock hauptsächlich zum
  // Starttag").
  const dayOwnedEntries = useMemo(() => entries.filter((e) => entryDateKey(e.date) === selectedDateKey), [entries, selectedDateKey]);

  const entriesByDay = useMemo(() => {
    const map: Record<string, Array<{ entry: DayPlanEntryDTO; segment: ContinuationSegment }>> = {};
    for (const e of entries) {
      for (const { dayKey, segment } of daySegmentsForEntry(e)) {
        (map[dayKey] ??= []).push({ entry: e, segment });
      }
    }
    return map;
  }, [entries]);

  async function handleToggle(id: string) {
    const res = await fetch(`/api/dayplan-entries/${id}/complete`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Konnte nicht abgehakt werden.", "error");
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === id ? data.entry : e)));
    if (data.entry.status === "DONE") {
      showToast(data.xpDelta > 0 ? `Erledigt – +${data.xpDelta} XP!` : "Als erledigt markiert.", data.xpDelta > 0 ? "xp" : "success");
    } else {
      showToast("Wieder geöffnet.", "info");
    }
  }

  async function handleCreate(values: EntryFormValues) {
    const res = await fetch("/api/dayplan-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, description: values.description || null, location: values.location || null, link: values.link || null, notes: values.notes || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Konnte nicht erstellt werden.");
    await fetchEntries();
    if (data.overlaps?.length) {
      showToast(`Achtung: Überschneidet sich mit „${data.overlaps[0].title}“ (${data.overlaps[0].startTime}–${data.overlaps[0].endTime} Uhr).`, "error");
    } else {
      showToast("Zeitblock erstellt.", "success");
    }
  }

  async function handleUpdate(id: string, values: Partial<EntryFormValues>, scope: "THIS" | "FOLLOWING" | "ALL") {
    const res = await fetch(`/api/dayplan-entries/${id}?scope=${scope}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, scope }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Konnte nicht gespeichert werden.");
    await fetchEntries();
    showToast(data.skippedPast > 0 ? `Gespeichert. ${data.skippedPast} vergangene Termine wurden nicht verändert.` : "Gespeichert.", "success");
  }

  async function handleDelete(id: string, scope: "THIS" | "FOLLOWING" | "ALL" = "THIS") {
    const res = await fetch(`/api/dayplan-entries/${id}?scope=${scope}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Konnte nicht gelöscht werden.", "error");
      return;
    }
    await fetchEntries();
    showToast(data.skippedPast > 0 ? `Gelöscht. ${data.skippedPast} vergangene Termine bleiben erhalten.` : "Gelöscht.", "info");
  }

  async function handleDuplicate(id: string, newDate?: string) {
    const res = await fetch(`/api/dayplan-entries/${id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDate ? { date: newDate } : {}),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Konnte nicht dupliziert werden.", "error");
      return;
    }
    await fetchEntries();
    showToast("Zeitblock dupliziert.", "success");
  }

  async function handleMoveTime(entry: DayPlanEntryDTO, newStartTime: string) {
    // Same-day drag within the day timeline: keep the entry's own start day, let the server
    // preserve the original duration (handles a crossing-midnight block correctly too).
    await performMove(entry.id, { date: entryDateKey(entry.date), startTime: newStartTime });
  }

  async function handleMoveToDay(entry: DayPlanEntryDTO, newDateKey: string) {
    await performMove(entry.id, { date: newDateKey, startTime: entry.startTime });
  }

  async function handleMoveQuick(id: string, delta: { addMinutes?: number; toTomorrow?: boolean }) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    if (delta.addMinutes) {
      const resolved = fromCombinedMinutes(combinedMinutes(entryDateKey(entry.date), entry.startTime) + delta.addMinutes);
      await performMove(entry.id, { date: resolved.date, startTime: resolved.time });
    } else if (delta.toTomorrow) {
      await performMove(entry.id, { date: dateKey(addDaysUtc(parseDateKey(entryDateKey(entry.date)), 1)), startTime: entry.startTime });
    }
  }

  async function performMove(id: string, body: { date: string; startTime: string; reason?: string }) {
    const res = await fetch(`/api/dayplan-entries/${id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Konnte nicht verschoben werden.", "error");
      return;
    }
    await fetchEntries();
    if (data.overlaps?.length) {
      showToast(`Verschoben – überschneidet sich mit „${data.overlaps[0].title}“.`, "error");
    } else {
      showToast("Verschoben.", "success");
    }
  }

  const weekDays = week.days.map((d) => ({ key: dateKey(d), weekday: isoWeekday(d), dayOfMonth: d.getUTCDate() }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F8F7FC] flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-[#A855F7]" /> Tagesplanung
          </h1>
          <p className="text-[#C8C5D2] mt-1">Plane genau, was du wann tun möchtest — unabhängig von deinen Routinen.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => { setManagePlanId(null); setManageOpen(true); }}>
            <FolderKanban className="h-4 w-4" /> Tagespläne
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setTemplatesOpen(true)}>
            <LayoutTemplate className="h-4 w-4" /> Vorlagen
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setQuickAddOpen(true)}>
            <Zap className="h-4 w-4" /> Schnellplanung
          </Button>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4" /> Tagesplan erstellen
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-xl border border-[#292936] bg-[#111118] p-1">
          {(
            [
              ["day", "Tag"],
              ["week", "Woche"],
              ["list", "Liste"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors",
                view === key ? "bg-[#A855F7] text-white" : "text-[#C8C5D2] hover:text-[#F8F7FC]"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {view !== "list" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDateKey(dateKey(addDaysUtc(parseDateKey(selectedDateKey), view === "day" ? -1 : -7)))}
              className="h-9 w-9 rounded-xl bg-[#111118] border border-[#292936] flex items-center justify-center text-[#C8C5D2] hover:text-[#A855F7]"
              aria-label="Zurück"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <span className="text-sm font-semibold text-[#F8F7FC] min-w-[160px] text-center">
              {view === "day" ? formatLongDateDe(parseDateKey(selectedDateKey)) : `${formatLongDateDe(week.start)} – ${formatLongDateDe(week.end)}`}
            </span>
            <button
              onClick={() => setSelectedDateKey(dateKey(addDaysUtc(parseDateKey(selectedDateKey), view === "day" ? 1 : 7)))}
              className="h-9 w-9 rounded-xl bg-[#111118] border border-[#292936] flex items-center justify-center text-[#C8C5D2] hover:text-[#A855F7]"
              aria-label="Weiter"
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
            {selectedDateKey !== todayKey && (
              <Button size="sm" variant="ghost" onClick={() => setSelectedDateKey(todayKey)}>
                Heute
              </Button>
            )}
          </div>
        )}
      </div>

      {view === "day" && <DayStatsBar entries={dayOwnedEntries} />}

      {loading ? (
        <div className="py-16 text-center text-sm text-[#8D8998]">Lädt…</div>
      ) : (
        <>
          {view === "day" &&
            (dayTouchingEntries.length === 0 && entries.length === 0 && !loading ? (
              <EmptyState
                illustration={<EmptyDayPlanIllustration className="w-full" />}
                title="Plane deinen Tag und behalte den Überblick."
                description="Erstelle deinen ersten Tagesplan oder nutze eine Vorlage, um schnell zu starten."
                action={
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setWizardOpen(true)}>
                      Ersten Tagesplan erstellen
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setTemplatesOpen(true)}>
                      Vorlage verwenden
                    </Button>
                  </div>
                }
              />
            ) : (
              <DayTimeline
                entries={dayTouchingEntries}
                selectedDateKey={selectedDateKey}
                isToday={selectedDateKey === todayKey}
                onToggle={handleToggle}
                onEdit={(entry) => setEntryModal({ entry })}
                onCreateAt={(startTime) => setEntryModal({ date: selectedDateKey, start: startTime, end: addMinutesClamped(startTime, 60) })}
                onMove={handleMoveTime}
                onDuplicate={(id) => handleDuplicate(id)}
                onDelete={(id) => handleDelete(id)}
              />
            ))}

          {view === "week" && (
            <WeekView
              days={weekDays}
              entriesByDay={entriesByDay}
              todayKey={todayKey}
              onToggle={handleToggle}
              onEdit={(entry) => setEntryModal({ entry })}
              onDuplicate={(id) => handleDuplicate(id)}
              onDelete={(id) => handleDelete(id)}
              onMoveToDay={handleMoveToDay}
              onSelectDay={(key) => {
                setSelectedDateKey(key);
                setView("day");
              }}
            />
          )}

          {view === "list" && (
            <ListView entries={entries} onToggle={handleToggle} onEdit={(entry) => setEntryModal({ entry })} onDuplicate={(id) => handleDuplicate(id)} onDelete={(id) => handleDelete(id)} />
          )}

          {view === "day" && <DaySummaryReview dateKey={selectedDateKey} isPastOrToday={selectedDateKey <= todayKey} />}
        </>
      )}

      <EntryFormModal
        open={!!entryModal}
        onClose={() => setEntryModal(null)}
        entry={entryModal?.entry}
        defaultDate={entryModal?.date}
        defaultStartTime={entryModal?.start}
        defaultEndTime={entryModal?.end}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onMoveQuick={handleMoveQuick}
        onOpenPlan={(dayPlanId) => {
          setEntryModal(null);
          setManagePlanId(dayPlanId);
          setManageOpen(true);
        }}
      />
      <DayPlanWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(overlapCount) => {
          fetchEntries();
          showToast(overlapCount > 0 ? `Tagesplan erstellt – ${overlapCount} Überschneidung(en) gefunden.` : "Tagesplan erstellt!", overlapCount > 0 ? "error" : "success");
        }}
      />
      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onCreated={fetchEntries} />
      <TemplatesPanel open={templatesOpen} onClose={() => setTemplatesOpen(false)} onApplied={fetchEntries} />
      <DayPlanManageModal
        open={manageOpen}
        initialPlanId={managePlanId}
        onClose={() => {
          setManageOpen(false);
          setManagePlanId(null);
        }}
        onChanged={fetchEntries}
      />

      {!xpForDayPlanning && (
        <p className="text-[11px] text-[#5F5B68] text-center">
          Tagesplan-Aufgaben geben standardmäßig keine XP. Aktivierbar in den Einstellungen.
        </p>
      )}
    </div>
  );
}
