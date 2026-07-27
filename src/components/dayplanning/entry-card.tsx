"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, MapPin, Link2, Repeat, MoreVertical, Pencil, Copy, ArrowRightLeft, Trash2, Undo2, PlayCircle } from "lucide-react";
import { DynamicIcon } from "@/components/ui/icon";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DAYPLAN_STATUS_META, DAYPLAN_PRIORITY_META } from "@/lib/dayplan-constants";
import { entrySpansMidnight, isEntryRunningNow } from "@/lib/dayplan-client-utils";
import type { DayPlanEntryDTO } from "@/lib/dayplan-types";

/** Which half of an overnight block this card renders -- "full" for same-day blocks. Both
 * halves are the same underlying row/id; this only controls the label/time shown. */
export type ContinuationSegment = "full" | "start" | "end";

export function EntryCard({
  entry,
  compact = false,
  dense = false,
  segment = "full",
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  draggable = false,
  onDragStart,
  overlapping = false,
  dateRangeLabel,
}: {
  entry: DayPlanEntryDTO;
  compact?: boolean;
  dense?: boolean;
  segment?: ContinuationSegment;
  onToggle: (id: string) => void;
  onEdit: (entry: DayPlanEntryDTO) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, entry: DayPlanEntryDTO) => void;
  overlapping?: boolean;
  /** List-view only: replaces the plain "HH:mm–HH:mm" label with the full weekday+date
   * range (e.g. "Montag, 20. Juli 2026 · 22:00 Uhr bis Dienstag, 21. Juli 2026 · 02:00
   * Uhr") so a block crossing midnight is never mistaken for a same-day one. */
  dateRangeLabel?: string;
}) {
  const done = entry.status === "DONE";
  const skipped = entry.status === "SKIPPED";
  const spansMidnight = entrySpansMidnight(entry);
  const runningNow = !done && !skipped && isEntryRunningNow(entry);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  const timeLabel =
    segment === "start" ? `${entry.startTime}–24:00` : segment === "end" ? `00:00–${entry.endTime}` : `${entry.startTime}–${entry.endTime}`;

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, entry)}
      className={clsx(
        "group relative rounded-xl border pl-3 pr-2 py-1.5 flex items-start gap-2 transition-all duration-200 ease-[var(--ease-out-soft)] cursor-pointer",
        done
          ? "bg-[#10241C] border-[#1F6B4A]"
          : skipped
          ? "bg-[#171720]/70 border-[#292936] opacity-60"
          : runningNow
          ? "bg-[#1D1730] border-[#A855F7] shadow-[0_0_0_1px_rgba(168,85,247,0.35)]"
          : "bg-[#111118] border-[#292936] hover:border-[#3D2A5C] hover:-translate-y-0.5",
        overlapping && !done && "ring-1 ring-[#FB7185]",
        segment === "start" && "rounded-b-none border-b-dashed",
        segment === "end" && "rounded-t-none border-t-dashed",
        dense ? "min-h-[24px]" : "min-h-[44px]"
      )}
      style={{ borderLeftColor: entry.color, borderLeftWidth: 3 }}
      onClick={() => onEdit(entry)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <DynamicIcon name={entry.icon} className="h-3.5 w-3.5 shrink-0" style={{ color: entry.color }} />
          <span className={clsx("text-sm font-semibold text-[#F8F7FC] truncate", done && "line-through opacity-70")}>
            {entry.title}
          </span>
          {entry.seriesId && <Repeat className="h-3 w-3 text-[#8D8998] shrink-0" aria-label="Teil einer Wiederholung" />}
          {runningNow && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#A855F7] shrink-0">
              <PlayCircle className="h-3 w-3" /> Läuft
            </span>
          )}
        </div>
        {!compact && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#C8C5D2] mt-0.5 flex-wrap">
            <span className="tabular-nums">{dateRangeLabel ?? timeLabel}</span>
            {!dateRangeLabel && segment === "start" && <span className="text-[#A855F7]">Fortsetzung am nächsten Tag</span>}
            {!dateRangeLabel && segment === "end" && <span className="text-[#A855F7]">Begonnen am Vortag um {entry.startTime}</span>}
            {!dateRangeLabel && segment === "full" && spansMidnight && <span className="text-[#A855F7]">bis zum nächsten Tag</span>}
            {dateRangeLabel && spansMidnight && <span className="text-[#A855F7] font-semibold">· Dauer über Nacht</span>}
            {entry.priority !== "NORMAL" && (
              <span className="font-semibold" style={{ color: DAYPLAN_PRIORITY_META[entry.priority].color }}>
                {DAYPLAN_PRIORITY_META[entry.priority].label}
              </span>
            )}
            {entry.location && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin className="h-3 w-3" /> {entry.location}
              </span>
            )}
            {entry.link && <Link2 className="h-3 w-3" />}
            {skipped && <span className="text-[#8D8998]">{DAYPLAN_STATUS_META.SKIPPED.label}</span>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(entry.id);
          }}
          aria-pressed={done}
          aria-label={done ? `${entry.title} als offen markieren` : `${entry.title} als erledigt markieren`}
          className={clsx(
            "h-6 w-6 rounded-full flex items-center justify-center border-2 shrink-0 transition-all duration-200",
            done ? "bg-[#34D399] border-[#34D399] text-white" : "border-[#D8B4FE] text-transparent hover:bg-[#171720]"
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </button>

        {(onDuplicate || onDelete) && !compact && (
          <div ref={menuRef} className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              aria-label="Weitere Aktionen"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[#8D8998] hover:text-[#F8F7FC] hover:bg-[#171720] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-7 z-30 w-44 rounded-xl border border-[#292936] bg-[#171720] shadow-[var(--shadow-lg)] py-1.5 animate-pop-in origin-top-right"
              >
                <MenuItem icon={<Pencil className="h-3.5 w-3.5" />} label="Bearbeiten" onClick={() => { setMenuOpen(false); onEdit(entry); }} />
                {onDuplicate && (
                  <MenuItem icon={<Copy className="h-3.5 w-3.5" />} label="Duplizieren" onClick={() => { setMenuOpen(false); onDuplicate(entry.id); }} />
                )}
                <MenuItem icon={<ArrowRightLeft className="h-3.5 w-3.5" />} label="Verschieben" onClick={() => { setMenuOpen(false); onEdit(entry); }} />
                <MenuItem
                  icon={done ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  label={done ? "Erledigung rückgängig machen" : "Als erledigt markieren"}
                  onClick={() => { setMenuOpen(false); onToggle(entry.id); }}
                />
                {onDelete && (
                  <MenuItem
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    label="Löschen"
                    danger
                    onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete(entry.id);
          }}
          title="Zeitblock löschen?"
          description="Diese Aktion kann nicht rückgängig gemacht werden."
          confirmLabel="Löschen"
        />
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors",
        danger ? "text-[#FB7185] hover:bg-[#2A1219]" : "text-[#C8C5D2] hover:bg-[#1D1D28] hover:text-[#F8F7FC]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
