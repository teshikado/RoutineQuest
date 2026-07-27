import { todayDateOnly, dateKey } from "./dates";

/** Helpers shared by day-planning client components. Deliberately separate from
 * src/lib/dayplan-service.ts, which imports the Prisma client and must never end up in a
 * client bundle -- this file only ever imports src/lib/dates.ts, which has no server-only
 * dependencies and is already safe in client components (see dashboard-client.tsx). */

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function durationMinutes(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const total = Math.max(0, Math.min(23 * 60 + 59, timeToMinutes(time) + minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}

// ---------- Combined start/end instant helpers (client mirror of dayplan-service.ts) ----------
// `date`/`endDate` here are the ISO strings a DayPlanEntryDTO carries over the wire -- always
// a UTC-midnight instant (RoutineQuest's date-only convention), so `new Date(iso).getTime()`
// is safe and unambiguous (unlike `new Date("YYYY-MM-DD")` on a bare date-only string).
function combinedMinutesClient(iso: string, time: string): number {
  const days = new Date(iso).getTime() / 86400000;
  return days * 1440 + timeToMinutes(time);
}

export function entrySpansMidnight(entry: { date: string; endDate: string }): boolean {
  return entry.date.slice(0, 10) !== entry.endDate.slice(0, 10);
}

/** Which day-column(s) an entry should render a card under, and which half. A same-day
 * entry renders once ("full"); an overnight entry renders on both its start day ("start":
 * startTime->24:00) and its end day ("end": 00:00->endTime) -- still the same underlying
 * row, just displayed on both affected days so neither view silently hides half of it. Only
 * the first/last day are shown for spans longer than one night (a rendering
 * simplification -- the data itself supports longer spans). */
export function daySegmentsForEntry(entry: { date: string; endDate: string }): Array<{ dayKey: string; segment: "full" | "start" | "end" }> {
  const startKey = entry.date.slice(0, 10);
  const endKey = entry.endDate.slice(0, 10);
  if (startKey === endKey) return [{ dayKey: startKey, segment: "full" }];
  return [
    { dayKey: startKey, segment: "start" },
    { dayKey: endKey, segment: "end" },
  ];
}

export function entryDurationMinutesClient(entry: { date: string; startTime: string; endDate: string; endTime: string }): number {
  return combinedMinutesClient(entry.endDate, entry.endTime) - combinedMinutesClient(entry.date, entry.startTime);
}

export function entriesOverlapClient(
  a: { date: string; startTime: string; endDate: string; endTime: string },
  b: { date: string; startTime: string; endDate: string; endTime: string }
): boolean {
  return combinedMinutesClient(a.date, a.startTime) < combinedMinutesClient(b.endDate, b.endTime) && combinedMinutesClient(b.date, b.startTime) < combinedMinutesClient(a.endDate, a.endTime);
}

/** Berlin wall-clock "HH:mm" for the current instant, independent of the browser's own
 * timezone (mirrors the Intl-based approach used throughout src/lib/dates.ts). */
export function berlinNowTime(): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
}

/** True while `now` falls inside [entry.date+startTime, entry.endDate+endTime) -- the
 * "Läuft gerade" status is derived, not stored, so a block that already ran past midnight
 * is never wrongly treated as finished just because its start day is in the past. */
export function isEntryRunningNow(entry: { date: string; startTime: string; endDate: string; endTime: string }): boolean {
  const todayIso = dateKey(todayDateOnly());
  const nowTime = berlinNowTime();
  const nowCombined = combinedMinutesClient(`${todayIso}T00:00:00.000Z`, nowTime);
  return combinedMinutesClient(entry.date, entry.startTime) <= nowCombined && nowCombined < combinedMinutesClient(entry.endDate, entry.endTime);
}
