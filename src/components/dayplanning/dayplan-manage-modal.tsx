"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowUp, ArrowDown, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DynamicIcon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { EntryFormModal, type EntryFormValues } from "./entry-form-modal";
import { DAYPLAN_COLORS, DAYPLAN_ICONS, DAYPLAN_RECURRENCE_META } from "@/lib/dayplan-constants";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { entryDateKey } from "@/lib/dayplan-types";
import { useToast } from "@/components/toast";
import type { DayPlanDTO, DayPlanEntryDTO } from "@/lib/dayplan-types";
import type { DayPlanRecurrenceType } from "@prisma/client";

export function DayPlanManageModal({
  open,
  onClose,
  initialPlanId,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  /** Opens straight into the editor for this plan instead of the list. */
  initialPlanId?: string | null;
  onChanged: () => void;
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
    showToast("Tagesplan gelöscht.", "info");
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
                    {entryDateKey(plan.startDate)} – {entryDateKey(plan.endDate)} · {DAYPLAN_RECURRENCE_META[plan.recurrenceType].label}
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
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Tagesplan löschen?"
        description="Alle enthaltenen Zeitblöcke werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </>
  );
}

function DayPlanEditor({ dayPlanId, onClose, onSaved }: { dayPlanId: string; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [plan, setPlan] = useState<(DayPlanDTO & { entries: DayPlanEntryDTO[] }) | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [color, setColor] = useState(DAYPLAN_COLORS[0]);
  const [icon, setIcon] = useState("CalendarClock");
  const [recurrenceType, setRecurrenceType] = useState<DayPlanRecurrenceType>("EVERY_DAY");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DayPlanEntryDTO | null>(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<DayPlanEntryDTO | null>(null);

  function load() {
    fetch(`/api/dayplans/${dayPlanId}`)
      .then((r) => r.json())
      .then((p: DayPlanDTO & { entries: DayPlanEntryDTO[] }) => {
        setPlan(p);
        setTitle(p.title);
        setDescription(p.description ?? "");
        setStartDate(entryDateKey(p.startDate));
        setEndDate(entryDateKey(p.endDate));
        setColor(p.color);
        setIcon(p.icon);
        setRecurrenceType(p.recurrenceType);
        setRecurrenceDays(p.recurrenceDays);
        setReminderEnabled(p.reminderMinutes !== null);
        setReminderMinutes(p.reminderMinutes ?? 15);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayPlanId]);

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
          recurrenceType,
          recurrenceDays: recurrenceType === "CUSTOM_DAYS" ? recurrenceDays : undefined,
          reminderMinutes: reminderEnabled ? reminderMinutes : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Tagesplan konnte nicht gespeichert werden.");
      showToast("Tagesplan erfolgreich aktualisiert.", "success");
      onSaved();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setSaving(false);
    }
  }

  async function moveEntryOrder(index: number, direction: -1 | 1) {
    if (!plan) return;
    const ids = plan.entries.map((e) => e.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await fetch(`/api/dayplans/${dayPlanId}/entries/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds: ids }),
    });
    load();
  }

  async function handleDeleteEntry() {
    if (!confirmDeleteEntry) return;
    await fetch(`/api/dayplan-entries/${confirmDeleteEntry.id}?scope=THIS`, { method: "DELETE" });
    showToast("Zeitblock gelöscht.", "info");
    setConfirmDeleteEntry(null);
    load();
    onSaved();
  }

  if (!plan) {
    return (
      <Modal open onClose={onClose} title="Tagesplan bearbeiten" maxWidth="max-w-2xl">
        <p className="text-sm text-[#8D8998]">Lädt…</p>
      </Modal>
    );
  }

  return (
    <>
      <Modal open onClose={onClose} title="Tagesplan bearbeiten" maxWidth="max-w-2xl">
        <form onSubmit={handleSaveMeta} className="space-y-4">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-start">Startdatum</Label>
              <Input id="edit-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-end">Enddatum</Label>
              <Input id="edit-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-[#8D8998] -mt-2">
            Änderungen am Zeitraum oder an der Wiederholung wirken sich nur auf künftig hinzugefügte Zeitblöcke aus — bereits erstellte Termine bleiben unverändert.
          </p>

          <div>
            <Label htmlFor="edit-recurrence">Wiederholung</Label>
            <select
              id="edit-recurrence"
              value={recurrenceType}
              onChange={(e) => setRecurrenceType(e.target.value as DayPlanRecurrenceType)}
              className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
            >
              {(["SINGLE_DAY", "EVERY_DAY", "WEEKDAYS", "WEEKEND", "CUSTOM_DAYS"] as const).map((key) => (
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
                    onClick={() => setRecurrenceDays((prev) => (prev.includes(Number(day)) ? prev.filter((d) => d !== Number(day)) : [...prev, Number(day)].sort()))}
                    aria-pressed={recurrenceDays.includes(Number(day))}
                    className={clsx("h-9 rounded-lg text-xs font-bold", recurrenceDays.includes(Number(day)) ? "bg-[#A855F7] text-white" : "bg-[#171720] text-[#C8C5D2]")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="mb-0">Enthaltene Zeitblöcke ({plan.entries.length})</Label>
            </div>
            {plan.entries.length === 0 ? (
              <p className="text-xs text-[#8D8998]">Noch keine Zeitblöcke in diesem Plan.</p>
            ) : (
              <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                {plan.entries.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-2 rounded-lg border border-[#292936] bg-[#111118] px-2.5 py-1.5">
                    <div className="flex flex-col shrink-0">
                      <button type="button" onClick={() => moveEntryOrder(i, -1)} disabled={i === 0} className="text-[#8D8998] hover:text-[#F8F7FC] disabled:opacity-30" aria-label="Nach oben">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => moveEntryOrder(i, 1)} disabled={i === plan.entries.length - 1} className="text-[#8D8998] hover:text-[#F8F7FC] disabled:opacity-30" aria-label="Nach unten">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="h-6 w-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: e.color + "22" }}>
                      <DynamicIcon name={e.icon} className="h-3 w-3" style={{ color: e.color }} />
                    </div>
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="text-[#F8F7FC] font-medium truncate">{e.title}</div>
                      <div className="text-[#8D8998]">
                        {entryDateKey(e.date)} {e.startTime}–{e.endTime}
                      </div>
                    </div>
                    <button type="button" onClick={() => setEditingEntry(e)} className="h-7 w-7 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#A855F7] hover:bg-[#171720]" aria-label="Bearbeiten">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteEntry(e)} className="h-7 w-7 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#FB7185] hover:bg-[#171720]" aria-label="Löschen">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <FieldError>{error}</FieldError>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Schließen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern…" : "Tagesplan speichern"}
            </Button>
          </div>
        </form>
      </Modal>

      {editingEntry && (
        <EntryFormModal
          open
          onClose={() => {
            setEditingEntry(null);
            load();
          }}
          entry={editingEntry}
          onCreate={async () => {}}
          onUpdate={async (id, values, scope) => {
            await fetch(`/api/dayplan-entries/${id}?scope=${scope}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...toApiPatch(values), scope }),
            });
          }}
          onDelete={async (id, scope) => {
            await fetch(`/api/dayplan-entries/${id}?scope=${scope}`, { method: "DELETE" });
          }}
          onDuplicate={async (id, newDate) => {
            await fetch(`/api/dayplan-entries/${id}/duplicate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date: newDate }),
            });
          }}
          onMoveQuick={async () => {}}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteEntry}
        onClose={() => setConfirmDeleteEntry(null)}
        onConfirm={handleDeleteEntry}
        title="Zeitblock löschen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </>
  );
}

function toApiPatch(values: Partial<EntryFormValues>) {
  return {
    title: values.title,
    description: values.description || null,
    date: values.date,
    endDate: values.endDate,
    startTime: values.startTime,
    endTime: values.endTime,
    category: values.category,
    priority: values.priority,
    color: values.color,
    icon: values.icon,
    location: values.location || null,
    link: values.link || null,
    notes: values.notes || null,
    reminderMinutes: values.reminderMinutes,
    status: values.status,
    linkedRoutineId: values.linkedRoutineId,
    linkedGroupRoutineId: values.linkedGroupRoutineId,
  };
}
