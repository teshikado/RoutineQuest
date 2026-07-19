"use client";

import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { DynamicIcon } from "@/components/ui/icon";
import { CATEGORY_META, DIFFICULTY_META, ROUTINE_COLORS, ROUTINE_ICONS, WEEKDAY_LABELS } from "@/lib/constants";
import { addDaysUtc, addMonthsUtc, dateKey, parseDateKey, todayDateOnly } from "@/lib/dates";
import type { Category, Difficulty } from "@prisma/client";

export type GroupRoutineFormValues = {
  title: string;
  description: string;
  category: Category;
  icon: string;
  color: string;
  difficulty: Difficulty;
  xpReward: string;
  startDate: string;
  endDate: string;
  scheduledDays: number[];
  timeOfDay: string;
  visibility: "ALL_MEMBERS" | "PARTICIPANTS_ONLY";
  mandatory: boolean;
  goalType: "NONE" | "WEEKLY";
  goalTarget: string;
};

const DEFAULT_VALUES: GroupRoutineFormValues = {
  title: "",
  description: "",
  category: "PRODUCTIVITY",
  icon: "Sparkles",
  color: ROUTINE_COLORS[0],
  difficulty: "MEDIUM",
  xpReward: String(DIFFICULTY_META.MEDIUM.xp),
  startDate: dateKey(todayDateOnly()),
  endDate: "",
  scheduledDays: [1, 2, 3, 4, 5],
  timeOfDay: "",
  visibility: "ALL_MEMBERS",
  mandatory: false,
  goalType: "NONE",
  goalTarget: "3",
};

type PeriodPreset = "week1" | "week2" | "month1" | "month3" | "custom";

const PERIOD_PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: "week1", label: "1 Woche" },
  { key: "week2", label: "2 Wochen" },
  { key: "month1", label: "1 Monat" },
  { key: "month3", label: "3 Monate" },
  { key: "custom", label: "Benutzerdefiniert" },
];

/** Inclusive end date for a period preset, given a start date. */
function endDateForPeriodPreset(preset: PeriodPreset, start: Date): Date | null {
  switch (preset) {
    case "week1":
      return addDaysUtc(start, 6);
    case "week2":
      return addDaysUtc(start, 13);
    case "month1":
      return addDaysUtc(addMonthsUtc(start, 1), -1);
    case "month3":
      return addDaysUtc(addMonthsUtc(start, 3), -1);
    case "custom":
      return null;
  }
}

/** Best-guess period preset for an existing start/end pair (used when editing/duplicating). */
function detectPeriodPreset(startDate: string, endDate: string): PeriodPreset {
  if (!startDate || !endDate) return "custom";
  const start = parseDateKey(startDate);
  for (const preset of ["week1", "week2", "month1", "month3"] as const) {
    const expected = endDateForPeriodPreset(preset, start);
    if (expected && dateKey(expected) === endDate) return preset;
  }
  return "custom";
}

type RepetitionPreset = "daily" | "weekdays" | "weekend" | "custom_days" | "weekly_count";

const REPETITION_PRESETS: { key: RepetitionPreset; label: string }[] = [
  { key: "daily", label: "Jeden Tag" },
  { key: "weekdays", label: "Nur Werktage" },
  { key: "weekend", label: "Nur Wochenende" },
  { key: "custom_days", label: "Bestimmte Wochentage" },
  { key: "weekly_count", label: "Bestimmte Anzahl pro Woche" },
];

const REPETITION_DAYS: Record<Exclude<RepetitionPreset, "custom_days" | "weekly_count">, number[]> = {
  daily: [1, 2, 3, 4, 5, 6, 7],
  weekdays: [1, 2, 3, 4, 5],
  weekend: [6, 7],
};

function detectRepetitionPreset(scheduledDays: number[], goalType: GroupRoutineFormValues["goalType"]): RepetitionPreset {
  if (goalType === "WEEKLY") return "weekly_count";
  const sorted = [...scheduledDays].sort((a, b) => a - b);
  const matches = (days: number[]) => sorted.length === days.length && days.every((d) => sorted.includes(d));
  if (matches(REPETITION_DAYS.daily)) return "daily";
  if (matches(REPETITION_DAYS.weekdays)) return "weekdays";
  if (matches(REPETITION_DAYS.weekend)) return "weekend";
  return "custom_days";
}

export function GroupRoutineForm({
  initialValues,
  onSubmit,
  submitLabel = "Gruppenroutine erstellen",
  onCancel,
}: {
  initialValues?: Partial<GroupRoutineFormValues>;
  onSubmit: (values: GroupRoutineFormValues) => Promise<void>;
  submitLabel?: string;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<GroupRoutineFormValues>({ ...DEFAULT_VALUES, ...initialValues });
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(() =>
    detectPeriodPreset(values.startDate, values.endDate)
  );
  const [repetitionPreset, setRepetitionPreset] = useState<RepetitionPreset>(() =>
    detectRepetitionPreset(values.scheduledDays, values.goalType)
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function applyPeriodPreset(preset: PeriodPreset, startOverride?: string) {
    setPeriodPreset(preset);
    const startKey = startOverride ?? values.startDate;
    if (preset === "custom" || !startKey) return;
    const end = endDateForPeriodPreset(preset, parseDateKey(startKey));
    if (end) setValues((v) => ({ ...v, startDate: startKey, endDate: dateKey(end) }));
  }

  function handleStartDateChange(startKey: string) {
    if (periodPreset === "custom") {
      setValues((v) => ({ ...v, startDate: startKey }));
    } else {
      applyPeriodPreset(periodPreset, startKey);
    }
  }

  function applyRepetitionPreset(preset: RepetitionPreset) {
    setRepetitionPreset(preset);
    if (preset === "custom_days") {
      setValues((v) => ({
        ...v,
        goalType: "NONE",
        scheduledDays: v.scheduledDays.length > 0 ? v.scheduledDays : [1, 2, 3, 4, 5],
      }));
    } else if (preset === "weekly_count") {
      setValues((v) => ({ ...v, goalType: "WEEKLY", scheduledDays: [1, 2, 3, 4, 5, 6, 7] }));
    } else {
      setValues((v) => ({ ...v, goalType: "NONE", scheduledDays: REPETITION_DAYS[preset] }));
    }
  }

  function toggleDay(day: number) {
    setValues((v) => ({
      ...v,
      scheduledDays: v.scheduledDays.includes(day)
        ? v.scheduledDays.filter((d) => d !== day)
        : [...v.scheduledDays, day].sort(),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!values.title.trim()) {
      setError("Bitte gib einen Titel ein.");
      return;
    }
    if (values.scheduledDays.length === 0) {
      setError("Wähle mindestens einen Wochentag.");
      return;
    }
    if (values.endDate && values.endDate < values.startDate) {
      setError("Das Enddatum muss nach dem Startdatum liegen.");
      return;
    }
    if (values.goalType === "WEEKLY" && (!values.goalTarget || Number(values.goalTarget) < 1)) {
      setError("Bitte gib eine Zielzahl pro Woche an.");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="gr-title">Titel</Label>
        <Input
          id="gr-title"
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          placeholder="z. B. Jeden Tag 30 Minuten Sport"
          maxLength={60}
          required
        />
      </div>

      <div>
        <Label htmlFor="gr-description">Kurze Beschreibung (optional)</Label>
        <textarea
          id="gr-description"
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          maxLength={300}
          rows={2}
          className="w-full rounded-xl border border-[#dbeaf3] bg-white px-3.5 py-2.5 text-sm text-[#183B56] placeholder:text-[#9db3c2] focus:outline-none focus:ring-2 focus:ring-[#4FA8D8] focus:border-transparent"
        />
      </div>

      <div>
        <Label htmlFor="gr-category">Kategorie</Label>
        <select
          id="gr-category"
          value={values.category}
          onChange={(e) => setValues((v) => ({ ...v, category: e.target.value as Category }))}
          className="w-full rounded-xl border border-[#dbeaf3] bg-white px-3.5 py-2.5 text-sm text-[#183B56] focus:outline-none focus:ring-2 focus:ring-[#4FA8D8]"
        >
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Symbol</Label>
        <div className="grid grid-cols-8 gap-2">
          {ROUTINE_ICONS.map((icon) => (
            <button
              type="button"
              key={icon}
              onClick={() => setValues((v) => ({ ...v, icon }))}
              aria-label={icon}
              aria-pressed={values.icon === icon}
              className={clsx(
                "h-9 w-9 rounded-lg flex items-center justify-center border transition-colors",
                values.icon === icon
                  ? "border-[#4FA8D8] bg-[#EAF7FC] text-[#4FA8D8]"
                  : "border-transparent bg-[#F5F7FA] text-[#5b7a91] hover:bg-[#EAF7FC]"
              )}
            >
              <DynamicIcon name={icon} className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Farbe</Label>
        <div className="flex gap-2 flex-wrap">
          {ROUTINE_COLORS.map((color) => (
            <button
              type="button"
              key={color}
              onClick={() => setValues((v) => ({ ...v, color }))}
              aria-label={`Farbe ${color}`}
              aria-pressed={values.color === color}
              className={clsx(
                "h-8 w-8 rounded-full border-2 transition-transform",
                values.color === color ? "border-[#183B56] scale-110" : "border-white"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div>
        <Label>Schwierigkeitsgrad</Label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(DIFFICULTY_META) as [Difficulty, (typeof DIFFICULTY_META)[Difficulty]][]).map(
            ([key, meta]) => (
              <button
                type="button"
                key={key}
                onClick={() => setValues((v) => ({ ...v, difficulty: key, xpReward: String(meta.xp) }))}
                aria-pressed={values.difficulty === key}
                className={clsx(
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                  values.difficulty === key
                    ? "border-[#4FA8D8] bg-[#EAF7FC] text-[#183B56]"
                    : "border-[#dbeaf3] text-[#5b7a91] hover:bg-[#F5F7FA]"
                )}
              >
                {meta.label}
                <div className="text-xs font-normal opacity-70">+{meta.xp} XP</div>
              </button>
            )
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="gr-xp">Anzahl der möglichen XP</Label>
        <Input
          id="gr-xp"
          type="number"
          min={5}
          max={500}
          value={values.xpReward}
          onChange={(e) => setValues((v) => ({ ...v, xpReward: e.target.value }))}
          required
        />
      </div>

      <div>
        <Label>Zeitraum</Label>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PERIOD_PRESETS.map((p) => (
            <button
              type="button"
              key={p.key}
              onClick={() => applyPeriodPreset(p.key)}
              aria-pressed={periodPreset === p.key}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                periodPreset === p.key
                  ? "bg-[#4FA8D8] text-white"
                  : "bg-[#F5F7FA] text-[#5b7a91] hover:bg-[#EAF7FC]"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="gr-start">Startdatum</Label>
            <Input
              id="gr-start"
              type="date"
              value={values.startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="gr-end">
              Enddatum {periodPreset === "custom" ? "(optional)" : ""}
            </Label>
            <Input
              id="gr-end"
              type="date"
              value={values.endDate}
              disabled={periodPreset !== "custom"}
              onChange={(e) => setValues((v) => ({ ...v, endDate: e.target.value }))}
              className={periodPreset !== "custom" ? "opacity-60" : ""}
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="gr-time">Uhrzeit (optional)</Label>
        <Input
          id="gr-time"
          type="time"
          value={values.timeOfDay}
          onChange={(e) => setValues((v) => ({ ...v, timeOfDay: e.target.value }))}
        />
      </div>

      <div>
        <Label>Wiederholung</Label>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {REPETITION_PRESETS.map((p) => (
            <button
              type="button"
              key={p.key}
              onClick={() => applyRepetitionPreset(p.key)}
              aria-pressed={repetitionPreset === p.key}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                repetitionPreset === p.key
                  ? "bg-[#4FA8D8] text-white"
                  : "bg-[#F5F7FA] text-[#5b7a91] hover:bg-[#EAF7FC]"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {repetitionPreset === "custom_days" && (
          <div className="grid grid-cols-7 gap-1.5">
            {Object.entries(WEEKDAY_LABELS).map(([day, label]) => (
              <button
                type="button"
                key={day}
                onClick={() => toggleDay(Number(day))}
                aria-pressed={values.scheduledDays.includes(Number(day))}
                className={clsx(
                  "h-10 rounded-lg text-xs font-bold transition-colors",
                  values.scheduledDays.includes(Number(day))
                    ? "bg-[#4FA8D8] text-white"
                    : "bg-[#F5F7FA] text-[#5b7a91] hover:bg-[#EAF7FC]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {repetitionPreset === "weekly_count" && (
          <div>
            <Label htmlFor="gr-goal-target">Wie oft pro Woche?</Label>
            <select
              id="gr-goal-target"
              value={values.goalTarget}
              onChange={(e) => setValues((v) => ({ ...v, goalTarget: e.target.value }))}
              className="w-full rounded-xl border border-[#dbeaf3] bg-white px-3.5 py-2.5 text-sm text-[#183B56] focus:outline-none focus:ring-2 focus:ring-[#4FA8D8]"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}× pro Woche
                </option>
              ))}
            </select>
            <p className="text-xs text-[#5b7a91] mt-1.5">
              Mitglieder können sich die Tage selbst aussuchen, an denen sie die Routine erledigen.
            </p>
          </div>
        )}
      </div>

      <div>
        <Label>Sichtbarkeit innerhalb der Gruppe</Label>
        <select
          value={values.visibility}
          onChange={(e) => setValues((v) => ({ ...v, visibility: e.target.value as GroupRoutineFormValues["visibility"] }))}
          className="w-full rounded-xl border border-[#dbeaf3] bg-white px-3.5 py-2.5 text-sm text-[#183B56] focus:outline-none focus:ring-2 focus:ring-[#4FA8D8]"
        >
          <option value="ALL_MEMBERS">Alle Gruppenmitglieder</option>
          <option value="PARTICIPANTS_ONLY">Nur Teilnehmende</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-[#183B56] font-medium">
        <input
          type="checkbox"
          checked={values.mandatory}
          onChange={(e) => setValues((v) => ({ ...v, mandatory: e.target.checked }))}
          className="h-4 w-4 rounded accent-[#4FA8D8]"
        />
        Verpflichtend für alle Mitglieder (kein Ablehnen möglich)
      </label>

      <FieldError>{error}</FieldError>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Abbrechen
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? "Speichern…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
