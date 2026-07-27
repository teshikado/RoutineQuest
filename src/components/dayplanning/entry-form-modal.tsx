"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Info, Moon, Copy } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DynamicIcon } from "@/components/ui/icon";
import {
  DAYPLAN_CATEGORY_META,
  DAYPLAN_PRIORITY_META,
  DAYPLAN_STATUS_META,
  DAYPLAN_COLORS,
  DAYPLAN_ICONS,
  REMINDER_OPTIONS,
} from "@/lib/dayplan-constants";
import { entryDateKey } from "@/lib/dayplan-types";
import { formatDurationLabel } from "@/lib/dayplan-client-utils";
import { dateKey, parseDateKey, addDaysUtc } from "@/lib/dates";
import type { DayPlanEntryDTO, LinkableRoutine, LinkableGroupRoutine } from "@/lib/dayplan-types";
import type { DayPlanEntryCategory, DayPlanEntryPriority } from "@prisma/client";

export type EntryFormValues = {
  title: string;
  description: string;
  date: string;
  endDate: string;
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
  status: "PLANNED" | "IN_PROGRESS" | "SKIPPED";
  linkedRoutineId: string | null;
  linkedGroupRoutineId: string | null;
};

const REMINDER_UNSUPPORTED = typeof window !== "undefined" && !("Notification" in window);
const EDITABLE_STATUSES: Array<EntryFormValues["status"]> = ["PLANNED", "IN_PROGRESS", "SKIPPED"];

function weekdayDate(dateKeyStr: string): string {
  if (!dateKeyStr) return "";
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${dateKeyStr}T00:00:00.000Z`));
}

function combinedMinutes(dateKeyStr: string, time: string): number {
  if (!dateKeyStr || !time) return 0;
  const days = new Date(`${dateKeyStr}T00:00:00.000Z`).getTime() / 86400000;
  const [h, m] = time.split(":").map(Number);
  return days * 1440 + h * 60 + m;
}

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
  onDuplicate,
  onMoveQuick,
  onOpenPlan,
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
  onDuplicate: (id: string, newDate: string) => Promise<void>;
  onMoveQuick: (id: string, minutesOrDate: { addMinutes?: number; toTomorrow?: boolean }, reason?: string) => Promise<void>;
  onOpenPlan?: (dayPlanId: string) => void;
}) {
  const isEdit = !!entry;
  const [values, setValues] = useState<EntryFormValues>(() => toValues(entry, defaultDate, defaultStartTime, defaultEndTime));
  const [scope, setScope] = useState<"THIS" | "FOLLOWING" | "ALL">("THIS");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateDate, setDuplicateDate] = useState("");
  const [linkables, setLinkables] = useState<{ routines: LinkableRoutine[]; groupRoutines: LinkableGroupRoutine[] } | null>(null);
  const [linkInfoShown, setLinkInfoShown] = useState(false);
  const [midnightPromptDismissed, setMidnightPromptDismissed] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    REMINDER_UNSUPPORTED ? "unsupported" : typeof window !== "undefined" ? Notification.permission : "default"
  );

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setValues(toValues(entry, defaultDate, defaultStartTime, defaultEndTime));
      setScope("THIS");
      setError(null);
      setLinkInfoShown(false);
      setMidnightPromptDismissed(false);
      setShowDuplicate(false);
    }, 0);
    fetch("/api/dayplan-entries/linkable")
      .then((r) => r.json())
      .then(setLinkables)
      .catch(() => setLinkables({ routines: [], groupRoutines: [] }));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  const endsNextDay = values.date && values.endDate && values.endDate > values.date;
  // Auto-detected "probably meant overnight": same day chosen, but end clock-time is not
  // after start clock-time -- almost certainly a midnight-crossing block, not a mistake.
  const looksLikeMidnightCrossing = values.date && values.endDate === values.date && values.endTime && values.startTime && values.endTime <= values.startTime;
  const durationMinutes = values.date && values.endDate ? combinedMinutes(values.endDate, values.endTime) - combinedMinutes(values.date, values.startTime) : 0;

  async function requestReminderPermission() {
    if (REMINDER_UNSUPPORTED) return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  }

  function applyNextDay() {
    const d = parseDateKey(values.date);
    setValues((v) => ({ ...v, endDate: dateKey(addDaysUtc(d, 1)) }));
    setMidnightPromptDismissed(true);
  }

  function toggleEndsNextDay(checked: boolean) {
    if (!values.date) return;
    const d = parseDateKey(values.date);
    setValues((v) => ({ ...v, endDate: checked ? dateKey(addDaysUtc(d, 1)) : values.date }));
    setMidnightPromptDismissed(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.title.trim()) {
      setError("Bitte gib einen Titel ein.");
      return;
    }
    if (!values.date) {
      setError("Bitte wähle ein Startdatum.");
      return;
    }
    if (!values.endDate) {
      setError("Bitte wähle ein Enddatum.");
      return;
    }
    if (looksLikeMidnightCrossing && !midnightPromptDismissed) {
      setError("Die Endzeit liegt vor der Startzeit. Bestätige oben, ob der Zeitblock am nächsten Tag enden soll.");
      return;
    }
    if (durationMinutes <= 0) {
      setError("Das Ende muss nach dem Start liegen. Wähle bei einer Planung über Mitternacht den nächsten Tag als Enddatum.");
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

  const previewLine = useMemo(() => {
    if (!values.date || !values.endDate || !values.startTime || !values.endTime) return null;
    const sameDay = values.date === values.endDate;
    return sameDay
      ? `${weekdayDate(values.date)}, ${values.startTime} Uhr bis ${values.endTime} Uhr`
      : `${weekdayDate(values.date)}, ${values.startTime} Uhr bis ${weekdayDate(values.endDate)}, ${values.endTime} Uhr`;
  }, [values.date, values.endDate, values.startTime, values.endTime]);

  return (
    <>
      <Modal open={open} onClose={onClose} title={isEdit ? "Zeitblock bearbeiten" : "Zeitblock erstellen"} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {isEdit && entry?.dayPlanId && onOpenPlan && (
            <button
              type="button"
              onClick={() => onOpenPlan(entry.dayPlanId!)}
              className="text-xs font-semibold text-[#A855F7] hover:underline underline-offset-2"
            >
              Zum vollständigen Tagesplan →
            </button>
          )}

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">Startdatum</Label>
              <Input
                id="date"
                type="date"
                value={values.date}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setMidnightPromptDismissed(false);
                  setValues((v) => ({ ...v, date: newDate, endDate: v.endDate && v.endDate >= newDate ? v.endDate : newDate }));
                }}
                required
              />
            </div>
            <div>
              <Label htmlFor="startTime">Startzeit</Label>
              <Input id="startTime" type="time" value={values.startTime} onChange={(e) => { setMidnightPromptDismissed(false); setValues((v) => ({ ...v, startTime: e.target.value })); }} required />
            </div>
            <div>
              <Label htmlFor="endDate">Enddatum</Label>
              <Input
                id="endDate"
                type="date"
                min={values.date}
                value={values.endDate}
                onChange={(e) => { setMidnightPromptDismissed(true); setValues((v) => ({ ...v, endDate: e.target.value })); }}
                required
              />
            </div>
            <div>
              <Label htmlFor="endTime">Endzeit</Label>
              <Input id="endTime" type="time" value={values.endTime} onChange={(e) => { setMidnightPromptDismissed(false); setValues((v) => ({ ...v, endTime: e.target.value })); }} required />
            </div>
          </div>

          <label className="flex items-center justify-between gap-2 rounded-xl border border-[#292936] px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium text-[#F8F7FC]">
              <Moon className="h-4 w-4 text-[#A855F7]" /> Endet am nächsten Tag
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!!endsNextDay}
              onClick={() => toggleEndsNextDay(!endsNextDay)}
              className={clsx("relative h-6 w-11 rounded-full shrink-0 transition-colors", endsNextDay ? "bg-[#A855F7]" : "bg-[#292936]")}
            >
              <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", endsNextDay ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          </label>
          {endsNextDay && values.endTime && (
            <p className="text-xs text-[#C8C5D2] -mt-2">
              Endet morgen um {values.endTime} Uhr.
            </p>
          )}

          {looksLikeMidnightCrossing && !midnightPromptDismissed && (
            <div className="rounded-xl border border-[#A855F7] bg-[#171720] p-3 space-y-2">
              <p className="text-sm text-[#F8F7FC]">
                Die Endzeit liegt vor der Startzeit. Soll der Zeitblock am nächsten Tag um {values.endTime} Uhr enden?
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={applyNextDay}>
                  Ja, nächster Tag
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setMidnightPromptDismissed(true)}>
                  Zeiten ändern
                </Button>
              </div>
            </div>
          )}

          {previewLine && (!looksLikeMidnightCrossing || midnightPromptDismissed) && (
            <div className="rounded-xl bg-[#171720] px-3.5 py-2.5 text-sm">
              <p className="text-[#F8F7FC] font-medium">{previewLine}</p>
              <p className="text-[#A855F7] font-semibold text-xs mt-0.5">
                {durationMinutes > 0 ? `Dauer: ${formatDurationLabel(durationMinutes)}` : "Ungültiger Zeitraum"}
              </p>
            </div>
          )}

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

          {isEdit && (
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={values.status}
                onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as EntryFormValues["status"] }))}
                className="w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
              >
                {EDITABLE_STATUSES.map((key) => (
                  <option key={key} value={key}>
                    {DAYPLAN_STATUS_META[key].label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#8D8998] mt-1.5">„Erledigt“ wird über den Haken auf der Karte gesetzt, nicht hier.</p>
            </div>
          )}

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
              <Label htmlFor="location">Ort (optional)</Label>
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

          {isEdit && entry && !showDuplicate && (
            <Button type="button" size="sm" variant="ghost" onClick={() => { setDuplicateDate(entryDateKey(entry.date)); setShowDuplicate(true); }}>
              <Copy className="h-3.5 w-3.5" /> Duplizieren
            </Button>
          )}
          {isEdit && entry && showDuplicate && (
            <div className="rounded-xl border border-[#292936] p-3 space-y-2">
              <Label htmlFor="dup-date" className="mb-0">Neues Datum für die Kopie</Label>
              <div className="flex gap-2">
                <Input id="dup-date" type="date" value={duplicateDate} onChange={(e) => setDuplicateDate(e.target.value)} />
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    await onDuplicate(entry.id, duplicateDate);
                    onClose();
                  }}
                >
                  Kopie erstellen
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
      endDate: entryDateKey(entry.endDate),
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
      status: entry.status === "DONE" || entry.status === "MOVED" ? "PLANNED" : entry.status,
      linkedRoutineId: entry.linkedRoutineId,
      linkedGroupRoutineId: entry.linkedGroupRoutineId,
    };
  }
  const meta = DAYPLAN_CATEGORY_META.OTHER;
  return {
    title: "",
    description: "",
    date: defaultDate ?? "",
    endDate: defaultDate ?? "",
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
    status: "PLANNED",
    linkedRoutineId: null,
    linkedGroupRoutineId: null,
  };
}
