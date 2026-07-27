"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";
import { EntryCard } from "./entry-card";
import { DAYPLAN_CATEGORY_META, DAYPLAN_STATUS_META } from "@/lib/dayplan-constants";
import { entryDateKey } from "@/lib/dayplan-types";
import { entryDurationMinutesClient, entrySpansMidnight, formatDurationLabel } from "@/lib/dayplan-client-utils";
import { EmptyState } from "@/components/ui/empty-state";
import type { DayPlanEntryDTO } from "@/lib/dayplan-types";
import type { DayPlanEntryCategory, DayPlanEntryStatus } from "@prisma/client";

function weekdayDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function rangeLabel(entry: DayPlanEntryDTO): string {
  if (!entrySpansMidnight(entry)) {
    return `${weekdayDate(entry.date)} · ${entry.startTime} Uhr bis ${entry.endTime} Uhr`;
  }
  return `${weekdayDate(entry.date)} · ${entry.startTime} Uhr bis ${weekdayDate(entry.endDate)} · ${entry.endTime} Uhr`;
}

export function ListView({
  entries,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  entries: DayPlanEntryDTO[];
  onToggle: (id: string) => void;
  onEdit: (entry: DayPlanEntryDTO) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DayPlanEntryCategory | "ALL">("ALL");
  const [status, setStatus] = useState<DayPlanEntryStatus | "ALL">("ALL");
  const [linkedOnly, setLinkedOnly] = useState<"ALL" | "LINKED" | "STANDALONE">("ALL");

  const filtered = useMemo(() => {
    return entries
      .filter((e) => (query.trim() ? e.title.toLowerCase().includes(query.trim().toLowerCase()) : true))
      .filter((e) => (category === "ALL" ? true : e.category === category))
      .filter((e) => (status === "ALL" ? true : e.status === status))
      .filter((e) => {
        if (linkedOnly === "ALL") return true;
        const isLinked = !!(e.linkedRoutineId || e.linkedGroupRoutineId);
        return linkedOnly === "LINKED" ? isLinked : !isLinked;
      })
      .sort((a, b) => (entryDateKey(a.date) + a.startTime).localeCompare(entryDateKey(b.date) + b.startTime));
  }, [entries, query, category, status, linkedOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, DayPlanEntryDTO[]>();
    for (const e of filtered) {
      const key = entryDateKey(e.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8D8998]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen…"
            className="w-full rounded-xl border border-[#292936] bg-[#111118] pl-9 pr-3.5 py-2 text-sm text-[#F8F7FC] placeholder:text-[#8D8998] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DayPlanEntryCategory | "ALL")}
          className="rounded-xl border border-[#292936] bg-[#111118] px-3 py-2 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
        >
          <option value="ALL">Alle Kategorien</option>
          {Object.entries(DAYPLAN_CATEGORY_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as DayPlanEntryStatus | "ALL")}
          className="rounded-xl border border-[#292936] bg-[#111118] px-3 py-2 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
        >
          <option value="ALL">Alle Status</option>
          {Object.entries(DAYPLAN_STATUS_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        <select
          value={linkedOnly}
          onChange={(e) => setLinkedOnly(e.target.value as typeof linkedOnly)}
          className="rounded-xl border border-[#292936] bg-[#111118] px-3 py-2 text-sm text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
        >
          <option value="ALL">Alle Einträge</option>
          <option value="LINKED">Nur verbundene Routinen</option>
          <option value="STANDALONE">Nur Tagesplan-Aufgaben</option>
        </select>
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon="ListChecks" title="Keine Einträge gefunden" description="Passe die Suche oder Filter an, oder erstelle einen neuen Zeitblock." />
      ) : (
        <div className="space-y-5">
          {grouped.map(([dateKey, dayEntries]) => (
            <div key={dateKey}>
              <h3 className={clsx("text-xs font-bold uppercase tracking-wide mb-2 text-[#8D8998]")}>{dateKey}</h3>
              <div className="space-y-2">
                {dayEntries.map((entry) => (
                  <div key={entry.id}>
                    <EntryCard entry={entry} onToggle={onToggle} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} dateRangeLabel={rangeLabel(entry)} />
                    <p className="text-[10px] text-[#8D8998] mt-0.5 ml-3.5">Dauer: {formatDurationLabel(entryDurationMinutesClient(entry))}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
