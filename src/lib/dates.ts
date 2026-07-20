/**
 * All date-only helpers operate on UTC-midnight `Date` objects and use UTC getters/setters
 * exclusively once a value has been normalized into that form, so day-only arithmetic
 * (adding/subtracting days, formatting, comparing) never shifts with the server's local
 * timezone.
 *
 * The one place this would go wrong is at the boundary where a *real* timestamp (like
 * "right now", or `routine.createdAt`) gets turned into "which calendar day is this" —
 * using the server's ambient local time (UTC on most hosts, including Vercel) instead of
 * the user's actual timezone silently applies the wrong day for part of every 24h cycle.
 * `toDateOnly`/`todayDateOnly` below are the only functions that do this conversion, and
 * they do it explicitly via `TIME_ZONE`, not via ambient local getters — see
 * `getZonedDateParts`.
 */

/** RoutineQuest's default timezone for interpreting calendar days (habit-tracking is
 * inherently day-based, so "today" must mean the user's local day, not the server's). A
 * fixed IANA zone name — not a fixed UTC offset — so DST (CET/CEST) is handled correctly. */
const TIME_ZONE = "Europe/Berlin";

/** Reads the wall-clock date/time that `instant` corresponds to in `timeZone`. */
function getZonedDateParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** The calendar day `instant` falls on in `TIME_ZONE`, represented as a UTC-midnight
 * `Date` (RoutineQuest's date-only convention — see the file header). This is the only
 * place "which day is it" gets decided, so every caller (today/future/past checks,
 * streaks, stats, weekday lookups, group-routine scheduling, ...) is timezone-correct. */
export function toDateOnly(date: Date): Date {
  const { year, month, day } = getZonedDateParts(date, TIME_ZONE);
  // `month` from Intl.DateTimeFormat parts is 1-indexed (Jan=1); Date.UTC's month
  // parameter is 0-indexed (Jan=0) — without the "-1" this silently shifts every
  // calendar day one month into the future.
  return new Date(Date.UTC(year, month - 1, day));
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

export function addMonthsUtc(date: Date, amount: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, date.getUTCDate()));
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

/**
 * The real UTC instant at which local midnight begins in `TIME_ZONE`, for the calendar
 * day `dateOnly` identifies (a UTC-midnight-anchored date-only value — e.g. from
 * `toDateOnly`/`parseDateKey`/`addDaysUtc`). Use this whenever a *real* timestamp (like
 * `routine.createdAt` or `routine.archivedAt`) needs to be compared against a day
 * boundary — comparing it against `dateOnly` itself would silently use UTC midnight
 * instead of the user's actual local midnight, off by 1-2 hours depending on DST.
 */
export function zonedStartOfDayUtc(dateOnly: Date): Date {
  const y = dateOnly.getUTCFullYear();
  const m = dateOnly.getUTCMonth();
  const d = dateOnly.getUTCDate();
  // First guess: treat Y-M-D 00:00:00 as if it were already a UTC instant, then see what
  // wall-clock time that instant actually reads as in TIME_ZONE, and correct by the
  // difference — the standard timezone-offset-without-a-library trick.
  const guess = new Date(Date.UTC(y, m, d, 0, 0, 0));
  const zoned = getZonedDateParts(guess, TIME_ZONE);
  const zonedAsUtcMillis = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  const driftMs = zonedAsUtcMillis - guess.getTime();
  return new Date(guess.getTime() - driftMs);
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

/** True once `createdAt` has happened by the end of the given calendar `day` (in
 * `TIME_ZONE`), regardless of time-of-day. */
export function existedOn(createdAt: Date, day: Date): boolean {
  return createdAt < zonedStartOfDayUtc(addDaysUtc(toDateOnly(day), 1));
}

const MONTH_NAMES_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export function formatLongDateDe(date: Date): string {
  return `${date.getUTCDate()}. ${MONTH_NAMES_DE[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
