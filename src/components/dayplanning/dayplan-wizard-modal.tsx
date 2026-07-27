"use client";

import { useState } from "react";
import clsx from "clsx";
import { Plus, Trash2, Moon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { DynamicIcon } from "@/components/ui/icon";
import {
  DAYPLAN_CATEGORY_META,
  DAYPLAN_COLORS,
  DAYPLAN_ICONS,
  DATE_RANGE_PRESETS,
  DAYPLAN_RECURRENCE_META,
  type DateRangePresetKey,
} from "@/lib/dayplan-constants";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { dateKey, todayDateOnly, addDaysUtc, addMonthsUtc } from "@/lib/dates";
import type { DayPlanRecurrenceType, DayPlanEntryCategory } from "@prisma/client";

type BlockDraft = {
  title: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  category: DayPlanEntryCategory;
};

function presetToRange(preset: DateRangePresetKey): { startDate: string; endDate: string } {
  const today = todayDateOnly();
  switch (preset) {
    case "today":
      return { startDate: dateKey(today), endDate: dateKey(today) };
    case "single":
      return { startDate: dateKey(today), endDate: dateKey(today) };
    case "week":
      return { startDate: dateKey(today), endDate: dateKey(addDaysUtc(today, 6)) };
    case "twoWeeks":
      return { startDate: dateKey(today), endDate: dateKey(addDaysUtc(today, 13)) };
    case "month":
      return { startDate: dateKey(today), endDate: dateKey(addDaysUtc(addMonthsUtc(today, 1), -1)) };
    case "custom":
      return { startDate: dateKey(today), endDate: dateKey(addDaysUtc(today, 6)) };
  }
}

export function DayPlanWizardModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (overlapCount: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preset, setPreset] = useState<DateRangePresetKey>("today");
  const [startDate, setStartDate] = useState(dateKey(todayDateOnly()));
  const [endDate, setEndDate] = useState(dateKey(todayDateOnly()));
  const [recurrenceType, setRecurrenceType] = useState<DayPlanRecurrenceType>("SINGLE_DAY");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [color, setColor] = useState(DAYPLAN_COLORS[0]);
  const [icon, setIcon] = useState("CalendarClock");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [blocks, setBlocks] = useState<BlockDraft[]>([{ title: "", startTime: "09:00", endTime: "10:00", endsNextDay: false, category: "OTHER" }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function applyPreset(key: DateRangePresetKey) {
    setPreset(key);
    const range = presetToRange(key);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setRecurrenceType(key === "today" || key === "single" ? "SINGLE_DAY" : "EVERY_DAY");
  }

  function updateBlock(i: number, patch: Partial<BlockDraft>) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  function toggleRecurrenceDay(day: number) {
    setRecurrenceDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function handleSubmit(e: React.FormEvent) {
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
    const validBlocks = blocks.filter((b) => b.title.trim());
    for (const b of validBlocks) {
      if (!b.endsNextDay && b.endTime <= b.startTime) {
        setError(`„${b.title}“: Die Endzeit muss nach der Startzeit liegen, oder aktiviere „Endet am nächsten Tag“.`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/dayplans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          startDate,
          endDate,
          color,
          icon,
          recurrenceType,
          recurrenceDays: recurrenceType === "CUSTOM_DAYS" ? recurrenceDays : undefined,
          reminderMinutes: reminderEnabled ? reminderMinutes : null,
          entries: validBlocks.map((b) => {
            const meta = DAYPLAN_CATEGORY_META[b.category];
            return {
              title: b.title,
              date: startDate, // ignored by the API for plan-scoped entries; kept for schema shape
              startTime: b.startTime,
              endTime: b.endTime,
              endsNextDay: b.endsNextDay,
              category: b.category,
              priority: "NORMAL",
              color: meta.color,
              icon: meta.icon,
            };
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Tagesplan konnte nicht erstellt werden.");
      onCreated(data.overlaps?.length ?? 0);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tagesplan erstellen" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <Label htmlFor="dp-title">Name</Label>
          <Input id="dp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Trading-Woche" maxLength={60} required />
        </div>

        <div>
          <Label htmlFor="dp-desc">Beschreibung (optional)</Label>
          <textarea
            id="dp-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={300}
            className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
        </div>

        <div>
          <Label>Zeitraum</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {DATE_RANGE_PRESETS.map((p) => (
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
        </div>

        {(preset === "custom" || preset === "single") && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dp-start">Startdatum</Label>
              <Input id="dp-start" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (preset === "single") setEndDate(e.target.value); }} />
            </div>
            {preset === "custom" && (
              <div>
                <Label htmlFor="dp-end">Enddatum</Label>
                <Input id="dp-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {startDate !== endDate && (
          <div>
            <Label>Wiederholung im Zeitraum</Label>
            <select
              value={recurrenceType}
              onChange={(e) => setRecurrenceType(e.target.value as DayPlanRecurrenceType)}
              className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
            >
              {(["EVERY_DAY", "WEEKDAYS", "WEEKEND", "CUSTOM_DAYS"] as const).map((key) => (
                <option key={key} value={key}>
                  {DAYPLAN_RECURRENCE_META[key].label}
                </option>
              ))}
            </select>
            {recurrenceType === "CUSTOM_DAYS" && (
              <div className="grid grid-cols-7 gap-1.5 mt-2">
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
            )}
          </div>
        )}

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

        <label className="flex items-center gap-2 text-sm text-[#F8F7FC] font-medium">
          <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} className="h-4 w-4 rounded accent-[#A855F7]" />
          Standard-Erinnerung für alle Zeitblöcke dieses Plans
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

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="mb-0">Zeitblöcke</Label>
            <Button type="button" size="sm" variant="ghost" onClick={() => setBlocks((b) => [...b, { title: "", startTime: "09:00", endTime: "10:00", endsNextDay: false, category: "OTHER" }])}>
              <Plus className="h-3.5 w-3.5" /> Block
            </Button>
          </div>
          <div className="space-y-2">
            {blocks.map((b, i) => (
              <div key={i} className="space-y-1">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1.5 items-center">
                  <Input value={b.title} onChange={(e) => updateBlock(i, { title: e.target.value })} placeholder="z. B. Sport" maxLength={60} />
                  <Input type="time" value={b.startTime} onChange={(e) => updateBlock(i, { startTime: e.target.value })} className="w-[100px]" />
                  <Input type="time" value={b.endTime} onChange={(e) => updateBlock(i, { endTime: e.target.value })} className="w-[100px]" />
                  <select
                    value={b.category}
                    onChange={(e) => updateBlock(i, { category: e.target.value as DayPlanEntryCategory })}
                    className="rounded-xl border border-[#292936] bg-[#111118] px-2 py-2.5 text-xs text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
                  >
                    {Object.entries(DAYPLAN_CATEGORY_META).map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setBlocks((prev) => prev.filter((_, idx) => idx !== i))} className="h-9 w-9 rounded-lg flex items-center justify-center text-[#8D8998] hover:text-[#FB7185] hover:bg-[#171720]" aria-label="Block entfernen">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => updateBlock(i, { endsNextDay: !b.endsNextDay })}
                  aria-pressed={b.endsNextDay}
                  className={clsx(
                    "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
                    b.endsNextDay ? "text-[#A855F7]" : "text-[#5F5B68] hover:text-[#8D8998]"
                  )}
                >
                  <Moon className="h-3 w-3" /> Endet am nächsten Tag
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#8D8998] mt-2">
            Jeder Zeitblock wird an allen Tagen erstellt, die zum gewählten Zeitraum und zur Wiederholung passen. Details wie
            Ort, Notiz oder eine Routinen-Verknüpfung lassen sich danach direkt am jeweiligen Eintrag ergänzen.
          </p>
        </div>

        <FieldError>{error}</FieldError>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Wird erstellt…" : "Tagesplan erstellen"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
