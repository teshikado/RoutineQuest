"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DynamicIcon } from "@/components/ui/icon";
import {
  DAYPLAN_CATEGORY_META,
  DAYPLAN_PRIORITY_META,
  DAYPLAN_COLORS,
  DAYPLAN_ICONS,
  REMINDER_OPTIONS,
} from "@/lib/dayplan-constants";
import { entryDateKey } from "@/lib/dayplan-types";
import type { DayPlanEntryDTO, LinkableRoutine, LinkableGroupRoutine } from "@/lib/dayplan-types";
import type { DayPlanEntryCategory, DayPlanEntryPriority } from "@prisma/client";

export type EntryFormValues = {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
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

const REMINDER_UNSUPPORTED = typeof window !== "undefined" && !("Notification" in window);

export function EntryFormModal({
  open,
  onClose,
  entry,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  onCreate,
  onUpdate,
  onDelete,
  onMoveQuick,
}: {
  open: boolean;
  onClose: () => void;
  /** Present when editing an existing entry; absent when creating a new standalone one. */
  entry?: DayPlanEntryDTO | null;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  onCreate: (values: EntryFormValues) => Promise<void>;
  onUpdate: (id: string, values: Partial<EntryFormValues>, scope: "THIS" | "FOLLOWING" | "ALL") => Promise<void>;
  onDelete: (id: string, scope: "THIS" | "FOLLOWING" | "ALL") => Promise<void>;
  onMoveQuick: (id: string, minutesOrDate: { addMinutes?: number; toTomorrow?: boolean }, reason?: string) => Promise<void>;
}) {
  const isEdit = !!entry;
  const [values, setValues] = useState<EntryFormValues>(() => toValues(entry, defaultDate, defaultStartTime, defaultEndTime));
  const [scope, setScope] = useState<"THIS" | "FOLLOWING" | "ALL">("THIS");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkables, setLinkables] = useState<{ routines: LinkableRoutine[]; groupRoutines: LinkableGroupRoutine[] } | null>(null);
  const [linkInfoShown, setLinkInfoShown] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    REMINDER_UNSUPPORTED ? "unsupported" : typeof window !== "undefined" ? Notification.permission : "default"
  );

  useEffect(() => {
    if (!open) return;
    // Deferred: resetting form state must not happen synchronously within the effect body.
    const id = setTimeout(() => {
      setValues(toValues(entry, defaultDate, defaultStartTime, defaultEndTime));
      setScope("THIS");
      setError(null);
      setLinkInfoShown(false);
    }, 0);
    fetch("/api/dayplan-entries/linkable")
      .then((r) => r.json())
      .then(setLinkables)
      .catch(() => setLinkables({ routines: [], groupRoutines: [] }));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  async function requestReminderPermission() {
    if (REMINDER_UNSUPPORTED) return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.title.trim()) {
      setError("Bitte gib einen Titel ein.");
      return;
    }
    if (values.endTime <= values.startTime) {
      setError("Die Endzeit muss nach der Startzeit liegen.");
      return;
    }
    setLoading(true);
    try {
      if (isEdit && entry) {
        await onUpdate(entry.id, values, scope);
      } else {
        await onCreate(values);
      }
      onClose();
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
    <>
      <Modal open={open} onClose={onClose} title={isEdit ? "Zeitblock bearbeiten" : "Zeitblock erstellen"} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
              placeholder="z. B. Backtesting"
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="date">Datum</Label>
              <Input id="date" type="date" value={values.date} onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))} required />
            </div>
            <div>
              <Label htmlFor="startTime">Start</Label>
              <Input id="startTime" type="time" value={values.startTime} onChange={(e) => setValues((v) => ({ ...v, startTime: e.target.value }))} required />
            </div>
            <div>
              <Label htmlFor="endTime">Ende</Label>
              <Input id="endTime" type="time" value={values.endTime} onChange={(e) => setValues((v) => ({ ...v, endTime: e.target.value }))} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="category">Kategorie</Label>
              <select
                id="category"
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
              <Label htmlFor="priority">Priorität</Label>
              <select
                id="priority"
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
                  className={clsx(
                    "h-9 w-9 rounded-lg flex items-center justify-center border transition-colors",
                    values.icon === icon ? "border-[#A855F7] bg-[#171720] text-[#A855F7]" : "border-transparent bg-[#171720] text-[#C8C5D2]"
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
              <Label htmlFor="location">Ort oder Link (optional)</Label>
              <Input id="location" value={values.location} onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="link">Link (optional)</Label>
              <Input id="link" value={values.link} onChange={(e) => setValues((v) => ({ ...v, link: e.target.value }))} maxLength={500} placeholder="https://…" />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notiz (optional)</Label>
            <textarea
              id="notes"
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              maxLength={1000}
              rows={2}
              className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] placeholder:text-[#8D8998] focus:outline-none focus:ring-2 focus:ring-[#A855F7] focus:border-transparent"
            />
          </div>

          <div>
            <Label htmlFor="reminder">Erinnerung</Label>
            <select
              id="reminder"
              value={values.reminderMinutes ?? ""}
              onChange={async (e) => {
                const val = e.target.value === "" ? null : Number(e.target.value);
                setValues((v) => ({ ...v, reminderMinutes: val }));
                if (val !== null && notificationPermission === "default") await requestReminderPermission();
              }}
              className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
            >
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value ?? ""}>
                  {opt.label}
                </option>
              ))}
            </select>
            {notificationPermission === "unsupported" && (
              <p className="text-xs text-[#FB7185] mt-1.5">Dein Browser unterstützt keine Benachrichtigungen.</p>
            )}
            {notificationPermission === "denied" && values.reminderMinutes !== null && (
              <p className="text-xs text-[#FB7185] mt-1.5">Benachrichtigungen sind für diese Seite blockiert. Erinnerungen werden nicht angezeigt.</p>
            )}
            {notificationPermission === "granted" && values.reminderMinutes !== null && (
              <p className="text-xs text-[#8D8998] mt-1.5">Erinnerungen funktionieren nur, solange RoutineQuest im Browser geöffnet ist.</p>
            )}
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
                setLinkInfoShown(true);
                const [kind, id] = val.split(":");
                setValues((v) => ({
                  ...v,
                  linkedRoutineId: kind === "routine" ? id : null,
                  linkedGroupRoutineId: kind === "group" ? id : null,
                }));
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
            {(linkInfoShown || linkedLabel) && (
              <p className="text-xs text-[#C8C5D2] flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#A855F7]" />
                Wird dieser Eintrag als erledigt markiert, gilt automatisch auch „{linkedLabel ?? "die verbundene Routine"}“ als
                erledigt. XP wird dabei nur einmal vergeben — nicht doppelt für Routine und Tagesplan.
              </p>
            )}
          </div>

          {isEdit && entry?.seriesId && (
            <div className="rounded-xl border border-[#292936] p-3 space-y-2">
              <Label className="mb-0">Diese Änderung gilt für</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["THIS", "Nur diesen"],
                    ["FOLLOWING", "Diesen + folgende"],
                    ["ALL", "Ganze Serie"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setScope(key)}
                    aria-pressed={scope === key}
                    className={clsx(
                      "rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors",
                      scope === key ? "border-[#A855F7] bg-[#171720] text-[#F8F7FC]" : "border-[#292936] text-[#C8C5D2]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#8D8998]">Bereits vergangene Termine werden dabei nie verändert.</p>
            </div>
          )}

          {isEdit && entry && (
            <div className="rounded-xl border border-[#292936] p-3 space-y-2">
              <Label className="mb-0">Schnell verschieben</Label>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="secondary" onClick={() => onMoveQuick(entry.id, { addMinutes: 15 })}>
                  +15 Min
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onMoveQuick(entry.id, { addMinutes: 30 })}>
                  +30 Min
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onMoveQuick(entry.id, { addMinutes: 60 })}>
                  +1 Std.
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onMoveQuick(entry.id, { toTomorrow: true })}>
                  Auf morgen
                </Button>
              </div>
            </div>
          )}

          <FieldError>{error}</FieldError>

          <div className="flex items-center justify-between gap-2 pt-2">
            {isEdit && (
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDelete(true)} disabled={loading}>
                Löschen
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Speichern…" : isEdit ? "Speichern" : "Zeitblock erstellen"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {isEdit && entry && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await onDelete(entry.id, scope);
            setConfirmDelete(false);
            onClose();
          }}
          title="Zeitblock löschen?"
          description={
            entry.seriesId
              ? "Diese Aktion kann nicht rückgängig gemacht werden. Vergangene Termine der Serie bleiben in jedem Fall erhalten."
              : "Diese Aktion kann nicht rückgängig gemacht werden."
          }
          confirmLabel="Löschen"
        />
      )}
    </>
  );
}

function toValues(entry?: DayPlanEntryDTO | null, defaultDate?: string, defaultStartTime?: string, defaultEndTime?: string): EntryFormValues {
  if (entry) {
    return {
      title: entry.title,
      description: entry.description ?? "",
      date: entryDateKey(entry.date),
      startTime: entry.startTime,
      endTime: entry.endTime,
      category: entry.category,
      priority: entry.priority,
      color: entry.color,
      icon: entry.icon,
      location: entry.location ?? "",
      link: entry.link ?? "",
      notes: entry.notes ?? "",
      reminderMinutes: entry.reminderMinutes,
      linkedRoutineId: entry.linkedRoutineId,
      linkedGroupRoutineId: entry.linkedGroupRoutineId,
    };
  }
  const meta = DAYPLAN_CATEGORY_META.OTHER;
  return {
    title: "",
    description: "",
    date: defaultDate ?? "",
    startTime: defaultStartTime ?? "09:00",
    endTime: defaultEndTime ?? "10:00",
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
