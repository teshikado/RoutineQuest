"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { dateKey, todayDateOnly, addDaysUtc } from "@/lib/dates";

const TYPE_LABELS: Record<string, string> = {
  TASKS_COUNT: "Gemeinsame Aufgaben (Anzahl)",
  STREAK_DAYS: "Tage in Folge aktiv",
  XP_TOTAL: "Gemeinsame XP",
  PERFECT_WEEK: "Perfekte Gruppenwoche (Mitglieder)",
};

export type ChallengeFormValues = {
  title: string;
  description: string;
  type: "TASKS_COUNT" | "STREAK_DAYS" | "XP_TOTAL" | "PERFECT_WEEK";
  target: string;
  startDate: string;
  endDate: string;
};

export function ChallengeForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: ChallengeFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const today = todayDateOnly();
  const [values, setValues] = useState<ChallengeFormValues>({
    title: "",
    description: "",
    type: "TASKS_COUNT",
    target: "500",
    startDate: dateKey(today),
    endDate: dateKey(addDaysUtc(today, 30)),
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.title.trim()) {
      setError("Bitte gib einen Titel ein.");
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
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="c-title">Titel</Label>
        <Input
          id="c-title"
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          placeholder="z. B. 500 Aufgaben im Monat"
          maxLength={60}
          required
        />
      </div>
      <div>
        <Label htmlFor="c-desc">Beschreibung (optional)</Label>
        <Input
          id="c-desc"
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          maxLength={200}
        />
      </div>
      <div>
        <Label htmlFor="c-type">Typ</Label>
        <select
          id="c-type"
          value={values.type}
          onChange={(e) => setValues((v) => ({ ...v, type: e.target.value as ChallengeFormValues["type"] }))}
          className="w-full rounded-xl border border-[#dbeaf3] bg-white px-3.5 py-2.5 text-sm text-[#183B56] focus:outline-none focus:ring-2 focus:ring-[#4FA8D8]"
        >
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="c-target">Ziel</Label>
        <Input
          id="c-target"
          type="number"
          min={1}
          value={values.target}
          onChange={(e) => setValues((v) => ({ ...v, target: e.target.value }))}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="c-start">Start</Label>
          <Input
            id="c-start"
            type="date"
            value={values.startDate}
            onChange={(e) => setValues((v) => ({ ...v, startDate: e.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="c-end">Ende</Label>
          <Input
            id="c-end"
            type="date"
            value={values.endDate}
            onChange={(e) => setValues((v) => ({ ...v, endDate: e.target.value }))}
            required
          />
        </div>
      </div>
      <FieldError>{error}</FieldError>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Abbrechen
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? "Speichern…" : "Challenge starten"}
        </Button>
      </div>
    </form>
  );
}
