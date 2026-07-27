"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Plus, Trash2, Copy, Pencil, Play } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DynamicIcon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { DAYPLAN_CATEGORY_META, DAYPLAN_COLORS, DAYPLAN_ICONS } from "@/lib/dayplan-constants";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { dateKey, todayDateOnly, addDaysUtc } from "@/lib/dates";
import { useToast } from "@/components/toast";
import type { DayPlanTemplateDTO } from "@/lib/dayplan-types";
import type { DayPlanEntryCategory, DayPlanRecurrenceType } from "@prisma/client";

type BlockDraft = { title: string; startTime: string; endTime: string; category: DayPlanEntryCategory };

export function TemplatesPanel({ open, onClose, onApplied }: { open: boolean; onClose: () => void; onApplied: () => void }) {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<DayPlanTemplateDTO[] | null>(null);
  const [editing, setEditing] = useState<DayPlanTemplateDTO | "new" | null>(null);
  const [applying, setApplying] = useState<DayPlanTemplateDTO | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DayPlanTemplateDTO | null>(null);

  function load() {
    fetch("/api/dayplan-templates")
      .then((r) => r.json())
      .then(setTemplates);
  }

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setEditing(null);
      setApplying(null);
    }, 0);
    load();
    return () => clearTimeout(id);
  }, [open]);

  async function handleDuplicate(t: DayPlanTemplateDTO) {
    await fetch(`/api/dayplan-templates/${t.id}/duplicate`, { method: "POST" });
    showToast("Vorlage dupliziert.", "success");
    load();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await fetch(`/api/dayplan-templates/${confirmDelete.id}`, { method: "DELETE" });
    showToast("Vorlage gelöscht.", "info");
    setConfirmDelete(null);
    load();
  }

  return (
    <>
      <Modal open={open && !editing && !applying} onClose={onClose} title="Meine Vorlagen" maxWidth="max-w-lg">
        <div className="space-y-3">
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Neue Vorlage
          </Button>

          {templates === null ? (
            <p className="text-sm text-[#8D8998]">Lädt…</p>
          ) : templates.length === 0 ? (
            <EmptyState icon="LayoutTemplate" title="Noch keine Vorlagen" description="Speichere wiederkehrende Tagespläne wie „Trading-Tag“ oder „Lerntag“ als Vorlage." />
          ) : (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id} className="rounded-xl border border-[#292936] bg-[#111118] p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: t.color + "22" }}>
                    <DynamicIcon name={t.icon} className="h-4 w-4" style={{ color: t.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#F8F7FC] truncate">{t.name}</div>
                    <div className="text-xs text-[#8D8998]">{t.entries.length} Zeitblöcke</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setApplying(t)} className="h-8 w-8 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#34D399] hover:bg-[#171720]" aria-label="Anwenden">
                      <Play className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditing(t)} className="h-8 w-8 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#A855F7] hover:bg-[#171720]" aria-label="Bearbeiten">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDuplicate(t)} className="h-8 w-8 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#A855F7] hover:bg-[#171720]" aria-label="Duplizieren">
                      <Copy className="h-4 w-4" />
                    </button>
                    <button onClick={() => setConfirmDelete(t)} className="h-8 w-8 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#FB7185] hover:bg-[#171720]" aria-label="Löschen">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      {editing && (
        <TemplateEditor
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {applying && (
        <ApplyTemplateModal
          template={applying}
          onClose={() => setApplying(null)}
          onApplied={(count) => {
            setApplying(null);
            showToast(`${count} Zeitblöcke aus „${applying.name}“ übernommen.`, "success");
            onApplied();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Vorlage löschen?"
        description="Bereits erstellte Zeitblöcke, die aus dieser Vorlage entstanden sind, bleiben erhalten."
      />
    </>
  );
}

function TemplateEditor({ template, onClose, onSaved }: { template: DayPlanTemplateDTO | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [color, setColor] = useState(template?.color ?? DAYPLAN_COLORS[0]);
  const [icon, setIcon] = useState(template?.icon ?? "LayoutTemplate");
  const [blocks, setBlocks] = useState<BlockDraft[]>(
    template?.entries.map((e) => ({ title: e.title, startTime: e.startTime, endTime: e.endTime, category: e.category })) ?? [
      { title: "", startTime: "09:00", endTime: "10:00", category: "OTHER" },
    ]
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateBlock(i: number, patch: Partial<BlockDraft>) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Bitte gib einen Namen ein.");
      return;
    }
    const validBlocks = blocks.filter((b) => b.title.trim());
    for (const b of validBlocks) {
      if (b.endTime <= b.startTime) {
        setError(`„${b.title}“: Die Endzeit muss nach der Startzeit liegen.`);
        return;
      }
    }
    setLoading(true);
    try {
      const payload = {
        name,
        description: description || null,
        color,
        icon,
        entries: validBlocks.map((b) => {
          const meta = DAYPLAN_CATEGORY_META[b.category];
          return { title: b.title, startTime: b.startTime, endTime: b.endTime, category: b.category, priority: "NORMAL", color: meta.color, icon: meta.icon };
        }),
      };
      const res = template
        ? await fetch(`/api/dayplan-templates/${template.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/dayplan-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Konnte nicht gespeichert werden.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={template ? "Vorlage bearbeiten" : "Neue Vorlage"} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="tpl-name">Name</Label>
          <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Trading-Tag" maxLength={60} required />
        </div>
        <div>
          <Label htmlFor="tpl-desc">Beschreibung (optional)</Label>
          <Input id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </div>
        <div>
          <Label>Icon</Label>
          <div className="grid grid-cols-8 gap-2">
            {DAYPLAN_ICONS.map((i) => (
              <button type="button" key={i} onClick={() => setIcon(i)} aria-pressed={icon === i} className={clsx("h-9 w-9 rounded-lg flex items-center justify-center border", icon === i ? "border-[#A855F7] bg-[#171720] text-[#A855F7]" : "border-transparent bg-[#171720] text-[#C8C5D2]")}>
                <DynamicIcon name={i} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Farbe</Label>
          <div className="flex gap-2 flex-wrap">
            {DAYPLAN_COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setColor(c)} aria-pressed={color === c} className={clsx("h-8 w-8 rounded-full border-2", color === c ? "border-[#F8F7FC] scale-110" : "border-transparent")} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="mb-0">Zeitblöcke</Label>
            <Button type="button" size="sm" variant="ghost" onClick={() => setBlocks((b) => [...b, { title: "", startTime: "09:00", endTime: "10:00", category: "OTHER" }])}>
              <Plus className="h-3.5 w-3.5" /> Block
            </Button>
          </div>
          <div className="space-y-2">
            {blocks.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1.5 items-center">
                <Input value={b.title} onChange={(e) => updateBlock(i, { title: e.target.value })} placeholder="Titel" maxLength={60} />
                <Input type="time" value={b.startTime} onChange={(e) => updateBlock(i, { startTime: e.target.value })} className="w-[100px]" />
                <Input type="time" value={b.endTime} onChange={(e) => updateBlock(i, { endTime: e.target.value })} className="w-[100px]" />
                <select value={b.category} onChange={(e) => updateBlock(i, { category: e.target.value as DayPlanEntryCategory })} className="rounded-xl border border-[#292936] bg-[#111118] px-2 py-2.5 text-xs text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]">
                  {Object.entries(DAYPLAN_CATEGORY_META).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setBlocks((prev) => prev.filter((_, idx) => idx !== i))} className="h-9 w-9 rounded-lg flex items-center justify-center text-[#8D8998] hover:text-[#FB7185]" aria-label="Entfernen">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ApplyTemplateModal({ template, onClose, onApplied }: { template: DayPlanTemplateDTO; onClose: () => void; onApplied: (count: number) => void }) {
  const today = todayDateOnly();
  const [mode, setMode] = useState<"today" | "tomorrow" | "specific" | "range">("today");
  const [date, setDate] = useState(dateKey(today));
  const [endDate, setEndDate] = useState(dateKey(addDaysUtc(today, 6)));
  const [recurrenceType, setRecurrenceType] = useState<DayPlanRecurrenceType>("EVERY_DAY");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    setError(null);
    setLoading(true);
    try {
      const startDate = mode === "today" ? dateKey(today) : mode === "tomorrow" ? dateKey(addDaysUtc(today, 1)) : mode === "specific" ? date : date;
      const body =
        mode === "range"
          ? { startDate, endDate, recurrenceType, recurrenceDays: recurrenceType === "CUSTOM_DAYS" ? recurrenceDays : undefined }
          : { startDate, recurrenceType: "SINGLE_DAY" };
      const res = await fetch(`/api/dayplan-templates/${template.id}/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Vorlage konnte nicht angewendet werden.");
      onApplied(data.count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`„${template.name}“ anwenden`} maxWidth="max-w-sm">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["today", "Auf heute"],
              ["tomorrow", "Auf morgen"],
              ["specific", "Bestimmter Tag"],
              ["range", "Zeitraum"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} onClick={() => setMode(key)} aria-pressed={mode === key} className={clsx("rounded-lg border px-2.5 py-2 text-xs font-semibold", mode === key ? "border-[#A855F7] bg-[#171720] text-[#F8F7FC]" : "border-[#292936] text-[#C8C5D2]")}>
              {label}
            </button>
          ))}
        </div>

        {(mode === "specific" || mode === "range") && (
          <div>
            <Label htmlFor="apply-date">{mode === "range" ? "Startdatum" : "Datum"}</Label>
            <Input id="apply-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
        {mode === "range" && (
          <>
            <div>
              <Label htmlFor="apply-end">Enddatum</Label>
              <Input id="apply-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="apply-recurrence">Wiederholung</Label>
              <select id="apply-recurrence" value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value as DayPlanRecurrenceType)} className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]">
                <option value="EVERY_DAY">Jeden Tag</option>
                <option value="WEEKDAYS">Nur Werktage</option>
                <option value="WEEKEND">Nur Wochenende</option>
                <option value="CUSTOM_DAYS">Bestimmte Wochentage</option>
              </select>
              {recurrenceType === "CUSTOM_DAYS" && (
                <div className="grid grid-cols-7 gap-1.5 mt-2">
                  {Object.entries(WEEKDAY_LABELS).map(([day, label]) => (
                    <button key={day} type="button" onClick={() => setRecurrenceDays((prev) => (prev.includes(Number(day)) ? prev.filter((d) => d !== Number(day)) : [...prev, Number(day)].sort()))} aria-pressed={recurrenceDays.includes(Number(day))} className={clsx("h-9 rounded-lg text-xs font-bold", recurrenceDays.includes(Number(day)) ? "bg-[#A855F7] text-white" : "bg-[#171720] text-[#C8C5D2]")}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button type="button" onClick={handleApply} disabled={loading}>
            {loading ? "Wird angewendet…" : "Anwenden"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
