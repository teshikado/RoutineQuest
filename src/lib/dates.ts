/**
 * All date-only helpers operate on UTC-midnight `Date` objects and use UTC getters/setters
 * exclusively, so behavior never shifts with the server's local timezone.
 */

export function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function todayDateOnly(): Date {
  return toDateOnly(new Date());
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDaysUtc(date: Date, amount: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + amount);
  return d;
}

export function dateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export type WeekInfo = {
  start: Date; // Monday, date-only (UTC)
  end: Date; // Sunday, date-only (UTC)
  days: Date[]; // 7 entries, Monday -> Sunday
  weekKey: string; // yyyy-MM-dd of the Monday, used as a stable identifier
};

/** Monday-anchored week containing `date`, offset by `weekOffset` whole weeks. */
export function getWeekInfo(date: Date, weekOffset = 0): WeekInfo {
  const base = toDateOnly(date);
  const weekday = isoWeekday(base); // 1..7
  const monday = addDaysUtc(base, -(weekday - 1));
  const start = addDaysUtc(monday, weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDaysUtc(start, i));
  const end = days[6];
  return { start, end, days, weekKey: dateKey(start) };
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

export function isFutureDay(date: Date): boolean {
  return dateKey(toDateOnly(date)) > dateKey(todayDateOnly());
}

export function isToday(date: Date): boolean {
  return dateKey(toDateOnly(date)) === dateKey(todayDateOnly());
}

/** True once `createdAt` has happened by the end of the given calendar `day`, regardless of time-of-day. */
export function existedOn(createdAt: Date, day: Date): boolean {
  return createdAt < addDaysUtc(toDateOnly(day), 1);
}

const MONTH_NAMES_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export function formatLongDateDe(date: Date): string {
  return `${date.getUTCDate()}. ${MONTH_NAMES_DE[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
