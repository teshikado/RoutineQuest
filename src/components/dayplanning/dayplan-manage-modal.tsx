"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Copy,
  Plus,
  ChevronDown,
  ChevronRight,
  Moon,
  Info,
  Undo2,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DynamicIcon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DAYPLAN_CATEGORY_META,
  DAYPLAN_PRIORITY_META,
  DAYPLAN_COLORS,
  DAYPLAN_ICONS,
  DATE_RANGE_PRESETS,
  REMINDER_OPTIONS,
  type DateRangePresetKey,
} from "@/lib/dayplan-constants";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { dateKey, parseDateKey, addDaysUtc, addMonthsUtc, todayDateOnly } from "@/lib/dates";
import { entryDateKey } from "@/lib/dayplan-types";
import { timeToMinutes, formatDurationLabel, generateDayPlanDatesClient } from "@/lib/dayplan-client-utils";
import { useToast } from "@/components/toast";
import type { DayPlanDTO, DayPlanOverviewDTO, DayPlanSeriesBlockDTO, LinkableRoutine, LinkableGroupRoutine } from "@/lib/dayplan-types";
import type { DayPlanRecurrenceType, DayPlanEntryCategory, DayPlanEntryPriority } from "@prisma/client";

const TIMEZONE_OPTIONS = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "UTC"];

function weekdayShort(dateKeyStr: string): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${dateKeyStr}T00:00:00.000Z`));
}

function daysForRecurrence(type: DayPlanRecurrenceType, days: number[]): number[] {
  switch (type) {
    case "EVERY_DAY":
      return [1, 2, 3, 4, 5, 6, 7];
    case "WEEKDAYS":
      return [1, 2, 3, 4, 5];
    case "WEEKEND":
      return [6, 7];
    case "CUSTOM_DAYS":
      return days;
    case "SINGLE_DAY":
    default:
      return [];
  }
}

function deriveRecurrenceType(days: number[]): DayPlanRecurrenceType {
  const s = new Set(days);
  if (s.size === 7) return "EVERY_DAY";
  if (s.size === 5 && [1, 2, 3, 4, 5].every((d) => s.has(d))) return "WEEKDAYS";
  if (s.size === 2 && s.has(6) && s.has(7)) return "WEEKEND";
  return "CUSTOM_DAYS";
}

function presetFromRange(startDate: string, endDate: string): DateRangePresetKey {
  if (startDate === endDate) return "single";
  const start = parseDateKey(startDate);
  if (endDate === dateKey(addDaysUtc(start, 6))) return "week";
  if (endDate === dateKey(addDaysUtc(start, 13))) return "twoWeeks";
  if (endDate === dateKey(addDaysUtc(addMonthsUtc(start, 1), -1))) return "month";
  if (endDate === dateKey(addDaysUtc(addMonthsUtc(start, 3), -1))) return "threeMonths";
  return "custom";
}

function rangeForPreset(preset: DateRangePresetKey, anchorStartKey: string): { startDate: string; endDate: string } {
  const anchor = parseDateKey(anchorStartKey);
  switch (preset) {
    case "today":
    case "single":
    case "custom":
      return { startDate: anchorStartKey, endDate: anchorStartKey };
    case "week":
      return { startDate: anchorStartKey, endDate: dateKey(addDaysUtc(anchor, 6)) };
    case "twoWeeks":
      return { startDate: anchorStartKey, endDate: dateKey(addDaysUtc(anchor, 13)) };
    case "month":
      return { startDate: anchorStartKey, endDate: dateKey(addDaysUtc(addMonthsUtc(anchor, 1), -1)) };
    case "threeMonths":
      return { startDate: anchorStartKey, endDate: dateKey(addDaysUtc(addMonthsUtc(anchor, 3), -1)) };
  }
}

/** Small collapsible section used throughout the plan editor -- weakly animated (a soft
 * height/opacity fade), and skips the animation entirely under `prefers-reduced-motion`. */
function Collapsible({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduceMotion = useReducedMotion();
  return (
    <div className="rounded-xl border border-[#292936]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-semibold text-[#F8F7FC]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 text-[#8D8998]" /> : <ChevronRight className="h-4 w-4 text-[#8D8998]" />}
          {title}
        </span>
        {badge}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DayPlanManageModal({
  open,
  onClose,
  initialPlanId,
  onChanged,
  onNavigateToDay,
}: {
  open: boolean;
  onClose: () => void;
  /** Opens straight into the editor for this plan instead of the list. */
  initialPlanId?: string | null;
  onChanged: () => void;
  /** Closes the whole modal and switches the main day/week/list view to this date, so a
   * specific occurrence can be adjusted via the existing day-view edit flow. */
  onNavigateToDay?: (dateKey: string) => void;
}) {
  const { showToast } = useToast();
  const [plans, setPlans] = useState<DayPlanDTO[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(initialPlanId ?? null);
  const [confirmDelete, setConfirmDelete] = useState<DayPlanDTO | null>(null);

  function loadList() {
    fetch("/api/dayplans")
      .then((r) => r.json())
      .then(setPlans);
  }

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setEditingId(initialPlanId ?? null), 0);
    loadList();
    return () => clearTimeout(id);
  }, [open, initialPlanId]);

  async function handleDelete() {
    if (!confirmDelete) return;
    await fetch(`/api/dayplans/${confirmDelete.id}`, { method: "DELETE" });
    showToast("Tagesplan gelöscht. Bereits erzielte XP und Statistiken bleiben erhalten.", "info");
    setConfirmDelete(null);
    loadList();
    onChanged();
  }

  return (
    <>
      <Modal open={open && !editingId} onClose={onClose} title="Meine Tagespläne" maxWidth="max-w-lg">
        {plans === null ? (
          <p className="text-sm text-[#8D8998]">Lädt…</p>
        ) : plans.length === 0 ? (
          <EmptyState icon="CalendarClock" title="Noch keine Tagespläne" description="Erstelle über „Tagesplan erstellen“ deinen ersten mehrtägigen Plan." />
        ) : (
          <ul className="space-y-2">
            {plans.map((plan) => (
              <li key={plan.id} className="rounded-xl border border-[#292936] bg-[#111118] p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: plan.color + "22" }}>
                  <DynamicIcon name={plan.icon} className="h-4 w-4" style={{ color: plan.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#F8F7FC] truncate">{plan.title}</div>
                  <div className="text-xs text-[#8D8998]">
                    {entryDateKey(plan.startDate)} – {entryDateKey(plan.endDate)}
                  </div>
                </div>
                <button onClick={() => setEditingId(plan.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#A855F7] hover:bg-[#171720]" aria-label="Bearbeiten">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setConfirmDelete(plan)} className="h-8 w-8 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#FB7185] hover:bg-[#171720]" aria-label="Löschen">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {editingId && (
        <DayPlanEditor
          dayPlanId={editingId}
          onClose={() => {
            setEditingId(null);
            if (initialPlanId) onClose();
          }}
          onSaved={() => {
            loadList();
            onChanged();
          }}
          onDeleted={() => {
            setEditingId(null);
            onClose();
            loadList();
            onChanged();
          }}
          onNavigateToDay={onNavigateToDay}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Tagesplan löschen?"
        description="Alle geplanten Zeitblöcke dieses Tagesplans werden entfernt. Bereits erzielte XP und dein Fortschritt bleiben davon unberührt. Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </>
  );
}

function DayPlanEditor({
  dayPlanId,
  onClose,
  onSaved,
  onDeleted,
  onNavigateToDay,
}: {
  dayPlanId: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onNavigateToDay?: (dateKey: string) => void;
}) {
  const { showToast } = useToast();
  const [overview, setOverview] = useState<DayPlanOverviewDTO | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [color, setColor] = useState(DAYPLAN_COLORS[0]);
  const [icon, setIcon] = useState("CalendarClock");
  const [timeZone, setTimeZone] = useState("Europe/Berlin");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const [editingBlock, setEditingBlock] = useState<DayPlanSeriesBlockDTO | "new" | null>(null);
  const [confirmDeleteBlock, setConfirmDeleteBlock] = useState<DayPlanSeriesBlockDTO | null>(null);
  const [confirmEndSeries, setConfirmEndSeries] = useState(false);
  const [confirmDeletePlan, setConfirmDeletePlan] = useState(false);

  function load() {
    fetch(`/api/dayplans/${dayPlanId}/overview`)
      .then((r) => r.json())
      .then((data: DayPlanOverviewDTO) => {
        setOverview(data);
        const p = data.plan;
        setTitle(p.title);
        setDescription(p.description ?? "");
        setStartDate(entryDateKey(p.startDate));
        setEndDate(entryDateKey(p.endDate));
        setColor(p.color);
        setIcon(p.icon);
        setTimeZone(p.timeZone);
        setRecurrenceDays(daysForRecurrence(p.recurrenceType, p.recurrenceDays));
        setReminderEnabled(p.reminderMinutes !== null);
        setReminderMinutes(p.reminderMinutes ?? 15);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayPlanId]);

  const isSingleDay = startDate === endDate;
  const preset = useMemo(() => (isSingleDay ? "single" : presetFromRange(startDate, endDate)), [startDate, endDate, isSingleDay]);
  const effectiveRecurrenceType: DayPlanRecurrenceType = isSingleDay ? "SINGLE_DAY" : deriveRecurrenceType(recurrenceDays);

  const previewDates = useMemo(
    () => generateDayPlanDatesClient(startDate, endDate, effectiveRecurrenceType, recurrenceDays),
    [startDate, endDate, effectiveRecurrenceType, recurrenceDays]
  );

  function applyPreset(key: DateRangePresetKey) {
    const range = rangeForPreset(key, startDate || dateKey(todayDateOnly()));
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }

  function toggleRecurrenceDay(day: number) {
    setRecurrenceDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function handleSaveMeta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Bitte gib einen Namen ein.");
      return;
    }
    if (endDate < startDate) {
      setError("Das Enddatum darf nicht vor dem Startdatum liegen.");
      return;
    }
    if (!isSingleDay && recurrenceDays.length === 0) {
      setError("Wähle mindestens einen Wochentag.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/dayplans/${dayPlanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          startDate,
          endDate,
          color,
          icon,
          timeZone,
          recurrenceType: effectiveRecurrenceType,
          recurrenceDays: effectiveRecurrenceType === "CUSTOM_DAYS" ? recurrenceDays : undefined,
          reminderMinutes: reminderEnabled ? reminderMinutes : null,
          syncFutureEntries: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Tagesplan konnte nicht gespeichert werden.");

      const sync = data.sync as { addedCount: number; removedCount: number; keptCustomizedCount: number; overlaps: unknown[] } | null;
      const parts: string[] = [];
      if (sync?.addedCount) parts.push(`${sync.addedCount} neue Termine`);
      if (sync?.removedCount) parts.push(`${sync.removedCount} entfernt`);
      if (sync?.keptCustomizedCount) parts.push(`${sync.keptCustomizedCount} individuelle Anpassungen behalten`);
      showToast(parts.length ? `Tagesplan erfolgreich aktualisiert. ${parts.join(", ")}.` : "Tagesplan erfolgreich aktualisiert.", "success");
      if (sync?.overlaps.length) showToast(`Achtung: ${sync.overlaps.length} neue Überschneidung(en) mit bestehenden Terminen.`, "error");

      onSaved();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setSaving(false);
    }
  }

  async function moveBlockOrder(index: number, direction: -1 | 1) {
    if (!overview) return;
    const ids = overview.blocks.map((b) => b.seriesId);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await fetch(`/api/dayplans/${dayPlanId}/entries/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesIds: ids }),
    });
    load();
    onSaved();
  }

  async function handleDeleteBlock() {
    if (!confirmDeleteBlock) return;
    const res = await fetch(`/api/dayplans/${dayPlanId}/series/${confirmDeleteBlock.seriesId}`, { method: "DELETE" });
    const data = await res.json();
    setConfirmDeleteBlock(null);
    if (!res.ok) {
      showToast(data.error ?? "Konnte nicht gelöscht werden.", "error");
      return;
    }
    showToast(
      data.keptCustomizedCount > 0
        ? `Zeitblock entfernt. ${data.keptCustomizedCount} individuell angepasste Tage bleiben erhalten.`
        : "Zeitblock aus der Serie entfernt.",
      "info"
    );
    load();
    onSaved();
  }

  async function handleDuplicateBlock(block: DayPlanSeriesBlockDTO) {
    const res = await fetch(`/api/dayplans/${dayPlanId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${block.title} (Kopie)`,
        description: block.description,
        startTime: block.startTime,
        endTime: block.endTime,
        endsNextDay: block.endsNextDay,
        category: block.category,
        priority: block.priority,
        color: block.color,
        icon: block.icon,
        location: block.location,
        link: block.link,
        notes: block.notes,
        reminderMinutes: block.reminderMinutes,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Konnte nicht dupliziert werden.", "error");
      return;
    }
    showToast("Zeitblock dupliziert.", "success");
    load();
    onSaved();
  }

  async function handleResetException(entryId: string) {
    const res = await fetch(`/api/dayplan-entries/${entryId}/reset-to-template`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Konnte nicht zurückgesetzt werden.", "error");
      return;
    }
    showToast("Tag wieder auf die ursprüngliche Planung zurückgesetzt.", "success");
    load();
    onSaved();
  }

  async function handleRestoreException(seriesId: string, date: string) {
    const res = await fetch(`/api/dayplans/${dayPlanId}/series/${seriesId}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Konnte nicht wiederhergestellt werden.", "error");
      return;
    }
    showToast("Tag wiederhergestellt.", "success");
    if (data.overlaps?.length) showToast(`Achtung: Überschneidet sich mit „${data.overlaps[0].title}“.`, "error");
    load();
    onSaved();
  }

  async function handleEndSeries() {
    const res = await fetch(`/api/dayplans/${dayPlanId}/end-series`, { method: "POST" });
    const data = await res.json();
    setConfirmEndSeries(false);
    if (!res.ok) {
      showToast(data.error ?? "Konnte nicht beendet werden.", "error");
      return;
    }
    showToast(
      data.keptCustomizedCount > 0
        ? `Serie beendet. ${data.removedCount} zukünftige Termine entfernt, ${data.keptCustomizedCount} individuelle Anpassungen bleiben erhalten.`
        : `Serie beendet. ${data.removedCount} zukünftige Termine entfernt.`,
      "info"
    );
    load();
    onSaved();
  }

  async function handleDeletePlan() {
    await fetch(`/api/dayplans/${dayPlanId}`, { method: "DELETE" });
    showToast("Tagesplan gelöscht. Bereits erzielte XP und Statistiken bleiben erhalten.", "info");
    setConfirmDeletePlan(false);
    onDeleted();
  }

  if (!overview) {
    return (
      <Modal open onClose={onClose} title="Tagesplan bearbeiten" maxWidth="max-w-2xl">
        <p className="text-sm text-[#8D8998]">Lädt…</p>
      </Modal>
    );
  }

  const exceptions = overview.blocks
    .flatMap((b) => [
      ...b.customizedDays.map((d) => ({ type: "modified" as const, date: d.date, entryId: d.entryId, blockTitle: d.title, seriesId: b.seriesId })),
      ...b.missingDays.map((d) => ({ type: "removed" as const, date: d, entryId: null, blockTitle: b.title, seriesId: b.seriesId })),
    ])
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <Modal open onClose={onClose} title="Tagesplan bearbeiten" maxWidth="max-w-2xl">
        <form onSubmit={handleSaveMeta} className="space-y-5 pb-24 sm:pb-0">
          <div className="rounded-xl bg-[#171720] px-3.5 py-2.5 text-xs text-[#C8C5D2]">
            Dieser Tagesplan läuft vom {entryDateKey(overview.plan.startDate)} bis {entryDateKey(overview.plan.endDate)} · {previewDates.length} geplante Tage · {overview.blocks.length} Zeitblöcke pro Tag
          </div>

          <div>
            <Label htmlFor="edit-title">Name</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required />
          </div>
          <div>
            <Label htmlFor="edit-desc">Beschreibung</Label>
            <textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={300}
              className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
            />
          </div>

          <div>
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-2">
              {DAYPLAN_ICONS.map((i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setIcon(i)}
                  aria-pressed={icon === i}
                  className={clsx("h-9 w-9 rounded-lg flex items-center justify-center border", icon === i ? "border-[#A855F7] bg-[#171720] text-[#A855F7]" : "border-transparent bg-[#171720] text-[#C8C5D2]")}
                >
                  <DynamicIcon name={i} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Farbe</Label>
            <div className="flex gap-2 flex-wrap">
              {DAYPLAN_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  aria-pressed={color === c}
                  className={clsx("h-8 w-8 rounded-full border-2", color === c ? "border-[#F8F7FC] scale-110" : "border-transparent")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* ---------- Zeitraum ---------- */}
          <div>
            <Label>Zeitraum</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
              {DATE_RANGE_PRESETS.filter((p) => p.key !== "today").map((p) => (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  aria-pressed={preset === p.key}
                  className={clsx(
                    "rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors text-left",
                    preset === p.key ? "border-[#A855F7] bg-[#171720] text-[#F8F7FC]" : "border-[#292936] text-[#C8C5D2]"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-start" className="text-xs">Startdatum</Label>
                <Input id="edit-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-end" className="text-xs">Enddatum</Label>
                <Input id="edit-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-[#8D8998] mt-2">
              Dieser Tagesplan läuft vom {startDate || "…"} bis {endDate || "…"}. Änderungen gelten ab heute für zukünftige Termine — bereits vergangene Termine und individuell angepasste Tage bleiben unverändert.
            </p>
          </div>

          {!isSingleDay && (
            <div>
              <Label>Wiederholungstage</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                <button type="button" onClick={() => setRecurrenceDays([1, 2, 3, 4, 5, 6, 7])} className="rounded-lg border border-[#292936] px-2.5 py-1.5 text-xs font-semibold text-[#C8C5D2] hover:border-[#A855F7] hover:text-[#F8F7FC]">
                  Jeden Tag
                </button>
                <button type="button" onClick={() => setRecurrenceDays([1, 2, 3, 4, 5])} className="rounded-lg border border-[#292936] px-2.5 py-1.5 text-xs font-semibold text-[#C8C5D2] hover:border-[#A855F7] hover:text-[#F8F7FC]">
                  Montag bis Freitag
                </button>
                <button type="button" onClick={() => setRecurrenceDays([6, 7])} className="rounded-lg border border-[#292936] px-2.5 py-1.5 text-xs font-semibold text-[#C8C5D2] hover:border-[#A855F7] hover:text-[#F8F7FC]">
                  Nur Wochenende
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Object.entries(WEEKDAY_LABELS).map(([day, label]) => (
                  <button
                    type="button"
                    key={day}
                    onClick={() => toggleRecurrenceDay(Number(day))}
                    aria-pressed={recurrenceDays.includes(Number(day))}
                    className={clsx("h-9 rounded-lg text-xs font-bold transition-colors", recurrenceDays.includes(Number(day)) ? "bg-[#A855F7] text-white" : "bg-[#171720] text-[#C8C5D2]")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---------- Kalendervorschau ---------- */}
          <Collapsible title="Kalendervorschau anzeigen" defaultOpen={showCalendar} badge={<span className="text-xs text-[#8D8998]">{previewDates.length} Tage</span>}>
            <div onClick={() => setShowCalendar(true)} className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {previewDates.slice(0, 90).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => onNavigateToDay?.(k)}
                  className="rounded-md bg-[#171720] border border-[#292936] px-2 py-1 text-[11px] text-[#C8C5D2] hover:border-[#A855F7] hover:text-[#F8F7FC]"
                >
                  {weekdayShort(k)}
                </button>
              ))}
              {previewDates.length > 90 && <span className="text-[11px] text-[#5F5B68] self-center">+{previewDates.length - 90} weitere</span>}
            </div>
          </Collapsible>

          {/* ---------- Geplanter Tagesablauf ---------- */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="mb-0">Geplanter Tagesablauf ({overview.blocks.length})</Label>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingBlock("new")}>
                <Plus className="h-3.5 w-3.5" /> Zeitblock
              </Button>
            </div>
            {overview.blocks.length === 0 ? (
              <p className="text-xs text-[#8D8998]">Noch keine Zeitblöcke in diesem Plan.</p>
            ) : (
              <ul className="space-y-1.5">
                {overview.blocks.map((b, i) => (
                  <li key={b.seriesId} className="rounded-lg border border-[#292936] bg-[#111118] px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col shrink-0">
                        <button type="button" onClick={() => moveBlockOrder(i, -1)} disabled={i === 0} className="text-[#8D8998] hover:text-[#F8F7FC] disabled:opacity-30" aria-label="Nach oben">
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => moveBlockOrder(i, 1)} disabled={i === overview.blocks.length - 1} className="text-[#8D8998] hover:text-[#F8F7FC] disabled:opacity-30" aria-label="Nach unten">
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="h-7 w-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: b.color + "22" }}>
                        <DynamicIcon name={b.icon} className="h-3.5 w-3.5" style={{ color: b.color }} />
                      </div>
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="text-[#F8F7FC] font-medium truncate flex items-center gap-1.5">
                          {b.title}
                          {b.endsNextDay && <Moon className="h-3 w-3 text-[#A855F7]" aria-label="Endet am nächsten Tag" />}
                        </div>
                        <div className="text-[#8D8998] flex items-center gap-1.5 flex-wrap">
                          <span>
                            {b.startTime}–{b.endTime} Uhr{b.endsNextDay && " (nächster Tag)"}
                          </span>
                          <span>· {DAYPLAN_CATEGORY_META[b.category].label}</span>
                          {b.customizedDays.length > 0 && <span className="text-[#A855F7]">· {b.customizedDays.length} individuell angepasst</span>}
                        </div>
                      </div>
                      <button type="button" onClick={() => setEditingBlock(b)} className="h-7 w-7 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#A855F7] hover:bg-[#171720]" aria-label="Bearbeiten">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDuplicateBlock(b)} className="h-7 w-7 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#A855F7] hover:bg-[#171720]" aria-label="Duplizieren">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteBlock(b)} className="h-7 w-7 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#FB7185] hover:bg-[#171720]" aria-label="Löschen">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---------- Erinnerungen ---------- */}
          <label className="flex items-center gap-2 text-sm text-[#F8F7FC] font-medium">
            <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} className="h-4 w-4 rounded accent-[#A855F7]" />
            Standard-Erinnerung für neue Zeitblöcke
          </label>
          {reminderEnabled && (
            <select
              value={reminderMinutes}
              onChange={(e) => setReminderMinutes(Number(e.target.value))}
              className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
            >
              <option value={0}>Zur Startzeit</option>
              <option value={5}>5 Minuten vorher</option>
              <option value={10}>10 Minuten vorher</option>
              <option value={15}>15 Minuten vorher</option>
              <option value={30}>30 Minuten vorher</option>
              <option value={60}>1 Stunde vorher</option>
            </select>
          )}

          {/* ---------- Individuell angepasste Tage ---------- */}
          {exceptions.length > 0 && (
            <Collapsible title="Individuell angepasste Tage" badge={<span className="text-xs text-[#8D8998]">{exceptions.length}</span>}>
              <ul className="space-y-1.5">
                {exceptions.map((ex) => (
                  <li key={`${ex.seriesId}-${ex.date}-${ex.type}`} className="flex items-center gap-2 rounded-lg bg-[#171720] px-2.5 py-2 text-xs">
                    <span className="text-[#F8F7FC] font-medium">{weekdayShort(ex.date)}</span>
                    <span className="text-[#8D8998] flex-1 min-w-0 truncate">
                      {ex.blockTitle} — {ex.type === "modified" ? "geändert" : "entfernt"}
                    </span>
                    {ex.type === "modified" && ex.entryId && (
                      <>
                        <button type="button" onClick={() => onNavigateToDay?.(ex.date)} className="text-[#A855F7] hover:underline shrink-0">
                          Bearbeiten
                        </button>
                        <button type="button" onClick={() => handleResetException(ex.entryId!)} className="text-[#8D8998] hover:text-[#F8F7FC] flex items-center gap-1 shrink-0">
                          <RotateCcw className="h-3 w-3" /> Zurücksetzen
                        </button>
                      </>
                    )}
                    {ex.type === "removed" && (
                      <button type="button" onClick={() => handleRestoreException(ex.seriesId, ex.date)} className="text-[#8D8998] hover:text-[#F8F7FC] flex items-center gap-1 shrink-0">
                        <Undo2 className="h-3 w-3" /> Wiederherstellen
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Collapsible>
          )}

          {/* ---------- Erweiterte Einstellungen ---------- */}
          <Collapsible title="Erweiterte Einstellungen">
            <div>
              <Label htmlFor="edit-tz" className="text-xs">Zeitzone</Label>
              <select
                id="edit-tz"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-[#FB7185]/40 bg-[#2A1219]/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-[#FB7185] flex items-center gap-1.5">
                <TriangleAlert className="h-3.5 w-3.5" /> Gefährliche Aktionen
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmEndSeries(true)}>
                  Serie ab heute beenden
                </Button>
                <Button type="button" size="sm" variant="danger" onClick={() => setConfirmDeletePlan(true)}>
                  Tagesplan löschen
                </Button>
              </div>
              <p className="text-[11px] text-[#C8C5D2]">
                „Serie beenden“ entfernt nur zukünftige, nicht individuell angepasste Termine — vergangene Tage und deine Statistik bleiben unverändert.
              </p>
            </div>
          </Collapsible>

          <FieldError>{error}</FieldError>

          <div className="hidden sm:flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Schließen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern…" : "Tagesplan speichern"}
            </Button>
          </div>

          {/* Sticky bottom save bar on mobile so the primary action is always reachable. */}
          <div className="sm:hidden fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-[#292936] bg-[#111118] p-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="flex-1">
              Schließen
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </form>
      </Modal>

      {editingBlock && (
        <SeriesBlockFormModal
          open
          dayPlanId={dayPlanId}
          block={editingBlock === "new" ? null : editingBlock}
          onClose={() => setEditingBlock(null)}
          onSaved={() => {
            setEditingBlock(null);
            load();
            onSaved();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteBlock}
        onClose={() => setConfirmDeleteBlock(null)}
        onConfirm={handleDeleteBlock}
        title="Zeitblock löschen?"
        description="Zukünftige, nicht individuell angepasste Termine dieses Zeitblocks werden entfernt. Vergangene Termine bleiben in jedem Fall erhalten."
        confirmLabel="Löschen"
      />
      <ConfirmDialog
        open={confirmEndSeries}
        onClose={() => setConfirmEndSeries(false)}
        onConfirm={handleEndSeries}
        title="Serie ab heute beenden?"
        description="Alle zukünftigen, nicht individuell angepassten Termine dieses Tagesplans werden entfernt. Vergangene Termine und deine Statistik bleiben unverändert."
        confirmLabel="Serie beenden"
      />
      <ConfirmDialog
        open={confirmDeletePlan}
        onClose={() => setConfirmDeletePlan(false)}
        onConfirm={handleDeletePlan}
        title="Tagesplan löschen?"
        description="Möchtest du den gesamten Tagesplan und alle zukünftigen Termine löschen? Bereits erzielte XP und Statistiken bleiben in deinem Konto erhalten. Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
      />
    </>
  );
}

// ---------- Series block (template) form ----------

type BlockFormValues = {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  category: DayPlanEntryCategory;
  priority: DayPlanEntryPriority;
  color: string;
  icon: string;
  location: string;
  link: string;
  notes: string;
  reminderMinutes: number | null;
  linkedRoutineId: string | null;
  linkedGroupRoutineId: string | null;
};

function blockToValues(block: DayPlanSeriesBlockDTO | null): BlockFormValues {
  if (!block) {
    const meta = DAYPLAN_CATEGORY_META.OTHER;
    return {
      title: "",
      description: "",
      startTime: "09:00",
      endTime: "10:00",
      endsNextDay: false,
      category: "OTHER",
      priority: "NORMAL",
      color: meta.color,
      icon: meta.icon,
      location: "",
      link: "",
      notes: "",
      reminderMinutes: null,
      linkedRoutineId: null,
      linkedGroupRoutineId: null,
    };
  }
  return {
    title: block.title,
    description: block.description ?? "",
    startTime: block.startTime,
    endTime: block.endTime,
    endsNextDay: block.endsNextDay,
    category: block.category,
    priority: block.priority,
    color: block.color,
    icon: block.icon,
    location: block.location ?? "",
    link: block.link ?? "",
    notes: block.notes ?? "",
    reminderMinutes: block.reminderMinutes,
    linkedRoutineId: block.linkedRoutineId,
    linkedGroupRoutineId: block.linkedGroupRoutineId,
  };
}

function SeriesBlockFormModal({
  open,
  dayPlanId,
  block,
  onClose,
  onSaved,
}: {
  open: boolean;
  dayPlanId: string;
  block: DayPlanSeriesBlockDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!block;
  const [values, setValues] = useState<BlockFormValues>(() => blockToValues(block));
  const [includeCustomized, setIncludeCustomized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkables, setLinkables] = useState<{ routines: LinkableRoutine[]; groupRoutines: LinkableGroupRoutine[] } | null>(null);

  useEffect(() => {
    fetch("/api/dayplan-entries/linkable")
      .then((r) => r.json())
      .then(setLinkables)
      .catch(() => setLinkables({ routines: [], groupRoutines: [] }));
  }, []);

  const durationMinutes = values.endsNextDay
    ? 24 * 60 - timeToMinutes(values.startTime) + timeToMinutes(values.endTime)
    : timeToMinutes(values.endTime) - timeToMinutes(values.startTime);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.title.trim()) {
      setError("Bitte gib einen Titel ein.");
      return;
    }
    if (!values.endsNextDay && values.endTime <= values.startTime) {
      setError("Die Endzeit muss nach der Startzeit liegen, oder aktiviere „Endet am nächsten Tag“.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        title: values.title,
        description: values.description || null,
        startTime: values.startTime,
        endTime: values.endTime,
        endsNextDay: values.endsNextDay,
        category: values.category,
        priority: values.priority,
        color: values.color,
        icon: values.icon,
        location: values.location || null,
        link: values.link || null,
        notes: values.notes || null,
        reminderMinutes: values.reminderMinutes,
        linkedRoutineId: values.linkedRoutineId,
        linkedGroupRoutineId: values.linkedGroupRoutineId,
      };
      const res = isEdit
        ? await fetch(`/api/dayplans/${dayPlanId}/series/${block!.seriesId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, includeCustomized }),
          })
        : await fetch(`/api/dayplans/${dayPlanId}/entries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Konnte nicht gespeichert werden.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setLoading(false);
    }
  }

  const linkedLabel = values.linkedRoutineId
    ? linkables?.routines.find((r) => r.id === values.linkedRoutineId)?.title
    : values.linkedGroupRoutineId
    ? linkables?.groupRoutines.find((r) => r.id === values.linkedGroupRoutineId)?.title
    : null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Zeitblock bearbeiten" : "Zeitblock hinzufügen"} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="block-title">Titel</Label>
          <Input id="block-title" value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} placeholder="z. B. Marktanalyse" maxLength={60} required />
        </div>

        <div>
          <Label htmlFor="block-desc">Beschreibung (optional)</Label>
          <textarea
            id="block-desc"
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            maxLength={300}
            rows={2}
            className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="block-start">Startzeit</Label>
            <Input id="block-start" type="time" value={values.startTime} onChange={(e) => setValues((v) => ({ ...v, startTime: e.target.value }))} required />
          </div>
          <div>
            <Label htmlFor="block-end">Endzeit</Label>
            <Input id="block-end" type="time" value={values.endTime} onChange={(e) => setValues((v) => ({ ...v, endTime: e.target.value }))} required />
          </div>
        </div>

        <label className="flex items-center justify-between gap-2 rounded-xl border border-[#292936] px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium text-[#F8F7FC]">
            <Moon className="h-4 w-4 text-[#A855F7]" /> Endet am nächsten Tag
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={values.endsNextDay}
            onClick={() => setValues((v) => ({ ...v, endsNextDay: !v.endsNextDay }))}
            className={clsx("relative h-6 w-11 rounded-full shrink-0 transition-colors", values.endsNextDay ? "bg-[#A855F7]" : "bg-[#292936]")}
          >
            <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", values.endsNextDay ? "translate-x-5" : "translate-x-0.5")} />
          </button>
        </label>

        <div className="rounded-xl bg-[#171720] px-3.5 py-2.5 text-sm">
          <p className="text-[#F8F7FC] font-medium">
            {values.startTime} Uhr bis {values.endTime} Uhr{values.endsNextDay && " am nächsten Tag"}
          </p>
          <p className="text-[#A855F7] font-semibold text-xs mt-0.5">{durationMinutes > 0 ? `Dauer: ${formatDurationLabel(durationMinutes)}` : "Ungültiger Zeitraum"}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="block-category">Kategorie</Label>
            <select
              id="block-category"
              value={values.category}
              onChange={(e) => {
                const category = e.target.value as DayPlanEntryCategory;
                const meta = DAYPLAN_CATEGORY_META[category];
                setValues((v) => ({ ...v, category, color: meta.color, icon: meta.icon }));
              }}
              className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
            >
              {Object.entries(DAYPLAN_CATEGORY_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="block-priority">Priorität</Label>
            <select
              id="block-priority"
              value={values.priority}
              onChange={(e) => setValues((v) => ({ ...v, priority: e.target.value as DayPlanEntryPriority }))}
              className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
            >
              {Object.entries(DAYPLAN_PRIORITY_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>Icon</Label>
          <div className="grid grid-cols-8 gap-2">
            {DAYPLAN_ICONS.map((icon) => (
              <button
                type="button"
                key={icon}
                onClick={() => setValues((v) => ({ ...v, icon }))}
                aria-pressed={values.icon === icon}
                className={clsx("h-9 w-9 rounded-lg flex items-center justify-center border transition-colors", values.icon === icon ? "border-[#A855F7] bg-[#171720] text-[#A855F7]" : "border-transparent bg-[#171720] text-[#C8C5D2]")}
              >
                <DynamicIcon name={icon} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Farbe</Label>
          <div className="flex gap-2 flex-wrap">
            {DAYPLAN_COLORS.map((color) => (
              <button
                type="button"
                key={color}
                onClick={() => setValues((v) => ({ ...v, color }))}
                aria-pressed={values.color === color}
                className={clsx("h-8 w-8 rounded-full border-2 transition-transform", values.color === color ? "border-[#F8F7FC] scale-110" : "border-transparent")}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="block-location">Ort (optional)</Label>
            <Input id="block-location" value={values.location} onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))} maxLength={120} />
          </div>
          <div>
            <Label htmlFor="block-link">Link (optional)</Label>
            <Input id="block-link" value={values.link} onChange={(e) => setValues((v) => ({ ...v, link: e.target.value }))} maxLength={500} placeholder="https://…" />
          </div>
        </div>

        <div>
          <Label htmlFor="block-notes">Notiz (optional)</Label>
          <textarea
            id="block-notes"
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            maxLength={1000}
            rows={2}
            className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
        </div>

        <div>
          <Label htmlFor="block-reminder">Erinnerung</Label>
          <select
            id="block-reminder"
            value={values.reminderMinutes ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, reminderMinutes: e.target.value === "" ? null : Number(e.target.value) }))}
            className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          >
            {REMINDER_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-[#292936] p-3 space-y-2">
          <Label className="mb-0">Mit Routine verbinden (optional)</Label>
          <select
            value={values.linkedRoutineId ?? values.linkedGroupRoutineId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                setValues((v) => ({ ...v, linkedRoutineId: null, linkedGroupRoutineId: null }));
                return;
              }
              const [kind, id] = val.split(":");
              setValues((v) => ({ ...v, linkedRoutineId: kind === "routine" ? id : null, linkedGroupRoutineId: kind === "group" ? id : null }));
            }}
            className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          >
            <option value="">Keine Verknüpfung</option>
            {linkables?.routines.map((r) => (
              <option key={r.id} value={`routine:${r.id}`}>
                {r.title}
              </option>
            ))}
            {linkables?.groupRoutines.map((r) => (
              <option key={r.id} value={`group:${r.id}`}>
                {r.title} ({r.groupName})
              </option>
            ))}
          </select>
          {linkedLabel && (
            <p className="text-xs text-[#C8C5D2] flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#A855F7]" />
              XP wird nur einmal vergeben — nicht doppelt für Routine und Tagesplan.
            </p>
          )}
        </div>

        {isEdit && block!.customizedDays.length > 0 && (
          <label className="flex items-start gap-2 rounded-xl border border-[#292936] p-3 text-xs text-[#C8C5D2]">
            <input type="checkbox" checked={includeCustomized} onChange={(e) => setIncludeCustomized(e.target.checked)} className="h-4 w-4 rounded accent-[#A855F7] mt-0.5" />
            <span>
              Auch die {block!.customizedDays.length} individuell angepassten Tage überschreiben (sonst bleiben sie unverändert erhalten).
            </span>
          </label>
        )}

        {isEdit && (
          <p className="text-[11px] text-[#8D8998]">
            Die Änderung gilt für alle zukünftigen Termine dieses Zeitblocks. Vergangene Termine bleiben immer unverändert.
          </p>
        )}

        <FieldError>{error}</FieldError>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Speichern…" : isEdit ? "Speichern" : "Zeitblock hinzufügen"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
