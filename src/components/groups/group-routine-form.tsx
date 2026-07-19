"use client";

import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { DynamicIcon } from "@/components/ui/icon";
import {
  CATEGORY_META,
  DIFFICULTY_META,
  GROUP_ROUTINE_GOAL_LABELS,
  GROUP_ROUTINE_VISIBILITY_LABELS,
  ROUTINE_COLORS,
  ROUTINE_ICONS,
  WEEKDAY_LABELS,
} from "@/lib/constants";
import { dateKey, todayDateOnly } from "@/lib/dates";
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (values.goalType === "WEEKLY" && (!values.goalTarget || Number(values.goalTarget) < 1)) {
      setError("Bitte gib eine Zielzahl für das Wochenziel an.");
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
        <Label>Wochentage</Label>
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="gr-start">Startdatum</Label>
          <Input
            id="gr-start"
            type="date"
            value={values.startDate}
            onChange={(e) => setValues((v) => ({ ...v, startDate: e.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="gr-end">Enddatum (optional)</Label>
          <Input
            id="gr-end"
            type="date"
            value={values.endDate}
            onChange={(e) => setValues((v) => ({ ...v, endDate: e.target.value }))}
          />
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Zusatzziel</Label>
          <select
            value={values.goalType}
            onChange={(e) => setValues((v) => ({ ...v, goalType: e.target.value as GroupRoutineFormValues["goalType"] }))}
            className="w-full rounded-xl border border-[#dbeaf3] bg-white px-3.5 py-2.5 text-sm text-[#183B56] focus:outline-none focus:ring-2 focus:ring-[#4FA8D8]"
          >
            {Object.entries(GROUP_ROUTINE_GOAL_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {values.goalType === "WEEKLY" && (
          <div>
            <Label htmlFor="gr-goal-target">Zielzahl pro Woche</Label>
            <Input
              id="gr-goal-target"
              type="number"
              min={1}
              max={7}
              value={values.goalTarget}
              onChange={(e) => setValues((v) => ({ ...v, goalTarget: e.target.value }))}
              required
            />
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
          {Object.entries(GROUP_ROUTINE_VISIBILITY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
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
