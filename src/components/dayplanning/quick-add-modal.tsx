"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { dateKey, todayDateOnly } from "@/lib/dates";

export function QuickAddModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(dateKey(todayDateOnly()));
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Bitte gib einen Titel ein.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/dayplan-entries/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date, startTime, durationMinutes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Konnte nicht erstellt werden.");
      setTitle("");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Schnellplanung" maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="qa-title">Titel</Label>
          <Input id="qa-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder='z. B. "Backtesting"' maxLength={60} required autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="qa-date">Datum</Label>
            <Input id="qa-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="qa-start">Startzeit</Label>
            <Input id="qa-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </div>
        </div>
        <div>
          <Label htmlFor="qa-duration">Dauer (Minuten)</Label>
          <Input
            id="qa-duration"
            type="number"
            min={5}
            max={720}
            step={5}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            required
          />
        </div>
        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Wird erstellt…" : "Erstellen"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
