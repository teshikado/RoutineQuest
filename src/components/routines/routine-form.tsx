"use client";

import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { DynamicIcon } from "@/components/ui/icon";
import {
  CATEGORY_META,
  DIFFICULTY_META,
  ROUTINE_COLORS,
  ROUTINE_ICONS,
  WEEKDAY_LABELS,
} from "@/lib/constants";
import type { Category, Difficulty } from "@prisma/client";

export type RoutineFormValues = {
  title: string;
  description: string;
  category: Category;
  icon: string;
  color: string;
  difficulty: Difficulty;
  scheduledDays: number[];
  timeOfDay: string;
  reminderEnabled: boolean;
};

const DEFAULT_VALUES: RoutineFormValues = {
  title: "",
  description: "",
  category: "PRODUCTIVITY",
  icon: "Sparkles",
  color: ROUTINE_COLORS[0],
  difficulty: "MEDIUM",
  scheduledDays: [1, 2, 3, 4, 5],
  timeOfDay: "",
  reminderEnabled: false,
};

export function RoutineForm({
  initialValues,
  onSubmit,
  submitLabel = "Routine erstellen",
  onCancel,
}: {
  initialValues?: Partial<RoutineFormValues>;
  onSubmit: (values: RoutineFormValues) => Promise<void>;
  submitLabel?: string;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<RoutineFormValues>({ ...DEFAULT_VALUES, ...initialValues });
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
        <Label htmlFor="title">Titel</Label>
        <Input
          id="title"
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          placeholder="z. B. Morgens 10 Minuten dehnen"
          maxLength={60}
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Beschreibung (optional)</Label>
        <textarea
          id="description"
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          maxLength={300}
          rows={2}
          className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] placeholder:text-[#8D8998] focus:outline-none focus:ring-2 focus:ring-[#A855F7] focus:border-transparent"
        />
      </div>

      <div>
        <Label htmlFor="category">Kategorie</Label>
        <select
          id="category"
          value={values.category}
          onChange={(e) => setValues((v) => ({ ...v, category: e.target.value as Category }))}
          className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
        >
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Icon</Label>
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
                  ? "border-[#A855F7] bg-[#171720] text-[#A855F7]"
                  : "border-transparent bg-[#171720] text-[#C8C5D2] hover:bg-[#171720]"
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
                values.color === color ? "border-[#F8F7FC] scale-110" : "border-transparent"
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
                onClick={() => setValues((v) => ({ ...v, difficulty: key }))}
                aria-pressed={values.difficulty === key}
                className={clsx(
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                  values.difficulty === key
                    ? "border-[#A855F7] bg-[#171720] text-[#F8F7FC]"
                    : "border-[#292936] text-[#C8C5D2] hover:bg-[#171720]"
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
                  ? "bg-[#A855F7] text-white"
                  : "bg-[#171720] text-[#C8C5D2] hover:bg-[#171720]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <Label htmlFor="timeOfDay">Uhrzeit (optional)</Label>
          <Input
            id="timeOfDay"
            type="time"
            value={values.timeOfDay}
            onChange={(e) => setValues((v) => ({ ...v, timeOfDay: e.target.value }))}
          />
        </div>
        <label className="flex items-center gap-2 mb-2.5 text-sm text-[#F8F7FC] font-medium">
          <input
            type="checkbox"
            checked={values.reminderEnabled}
            onChange={(e) => setValues((v) => ({ ...v, reminderEnabled: e.target.checked }))}
            className="h-4 w-4 rounded accent-[#A855F7]"
          />
          Erinnerung aktivieren
        </label>
      </div>

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
