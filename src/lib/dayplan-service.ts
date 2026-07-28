import { randomUUID } from "node:crypto";
import type { DayPlanEntry, DayPlanRecurrenceType, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { addDaysUtc, dateKey, isFutureDay, isoWeekday, parseDateKey, todayDateOnly } from "./dates";
import { recomputeTotalXp } from "./completion-service";
import { toggleCompletion, CompletionError } from "./completion-service";
import { toggleGroupRoutineCompletion, GroupRoutineCompletionError } from "./group-routine-completion-service";
import { DAYPLAN_ENTRY_XP, MAX_DAYPLAN_RANGE_DAYS } from "./dayplan-constants";

export type DayPlanErrorCode =
  | "NOT_FOUND"
  | "NOT_AUTHORIZED"
  | "INVALID_START_DATE"
  | "INVALID_END_DATE"
  | "END_BEFORE_START"
  | "SAME_START_AND_END"
  | "TIME_OVERLAP"
  | "PLAN_NOT_FOUND"
  | "ENTRY_NOT_FOUND"
  | "INVALID_TIMEZONE"
  | "UPDATE_FAILED"
  | "FUTURE_DAY"
  | "RANGE_TOO_LARGE";

export class DayPlanError extends Error {
  code: DayPlanErrorCode;
  constructor(message: string, code: DayPlanErrorCode) {
    super(message);
    this.code = code;
  }
}

// ---------- Combined start/end instant helpers ----------
// A DayPlanEntry's real-world position in time is only meaningful as the *combination* of
// its date-only field and its "HH:mm" wall-clock field -- comparing `startTime`/`endTime`
// strings alone (the pre-existing approach) silently assumed same-day blocks and broke for
// anything crossing midnight. `combinedMinutes` turns (date, "HH:mm") into a single
// monotonically increasing number (days-since-epoch * 1440 + minutes-of-day) so ordering,
// duration, and overlap all become plain arithmetic again, exactly like the old same-day
// code, just no longer assuming both sides fall on the same calendar day. This is
// deliberately "naive" wall-clock day arithmetic (every day counted as exactly 1440
// minutes) rather than a real UTC-instant conversion -- that's what users actually expect
// from a scheduled block's duration (a 22:00-02:00 block is "4 hours" even across a DST
// transition night), and it avoids reintroducing the UTC-conversion class of bug fixed
// earlier in this project's history.
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(totalMinutesOfDay: number): string {
  const h = Math.floor(totalMinutesOfDay / 60);
  const m = totalMinutesOfDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function combinedMinutes(dateOnly: Date, time: string): number {
  const days = dateOnly.getTime() / 86400000; // exact integer: dateOnly is always UTC midnight
  return days * 1440 + timeToMinutes(time);
}
function fromCombinedMinutes(total: number): { date: Date; time: string } {
  const days = Math.floor(total / 1440);
  const minutesOfDay = total - days * 1440;
  return { date: new Date(days * 86400000), time: minutesToTime(minutesOfDay) };
}

export function entryDurationMinutes(date: Date, startTime: string, endDate: Date, endTime: string): number {
  return combinedMinutes(endDate, endTime) - combinedMinutes(date, startTime);
}

export function entriesOverlap(
  aDate: Date,
  aStart: string,
  aEndDate: Date,
  aEnd: string,
  bDate: Date,
  bStart: string,
  bEndDate: Date,
  bEnd: string
): boolean {
  return combinedMinutes(aDate, aStart) < combinedMinutes(bEndDate, bEnd) && combinedMinutes(bDate, bStart) < combinedMinutes(aEndDate, aEnd);
}

/** All calendar days within [startDate, endDate] (inclusive, both date-only UTC-midnight
 * values) that match the given recurrence rule. SINGLE_DAY/EVERY_DAY both return every day
 * in the range -- callers pick SINGLE_DAY only when startDate === endDate. */
export function generateDayPlanDates(
  startDate: Date,
  endDate: Date,
  recurrenceType: DayPlanRecurrenceType,
  recurrenceDays: number[]
): Date[] {
  const dates: Date[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    const weekday = isoWeekday(cursor);
    const matches =
      recurrenceType === "SINGLE_DAY" ||
      recurrenceType === "EVERY_DAY" ||
      (recurrenceType === "WEEKDAYS" && weekday >= 1 && weekday <= 5) ||
      (recurrenceType === "WEEKEND" && (weekday === 6 || weekday === 7)) ||
      (recurrenceType === "CUSTOM_DAYS" && recurrenceDays.includes(weekday));
    if (matches) dates.push(cursor);
    cursor = addDaysUtc(cursor, 1);
  }
  return dates;
}

function assertValidRange(startDate: Date, endDate: Date) {
  if (endDate < startDate) {
    throw new DayPlanError("Das Enddatum darf nicht vor dem Startdatum liegen.", "INVALID_END_DATE");
  }
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  if (days > MAX_DAYPLAN_RANGE_DAYS) {
    throw new DayPlanError(`Der Zeitraum darf höchstens ${MAX_DAYPLAN_RANGE_DAYS} Tage umfassen.`, "RANGE_TOO_LARGE");
  }
}

export type OverlapInfo = { date: string; endDate: string; title: string; startTime: string; endTime: string };

async function findOverlappingEntries(
  userId: string,
  date: Date,
  startTime: string,
  endDate: Date,
  endTime: string,
  excludeEntryId?: string
): Promise<DayPlanEntry[]> {
  // Day-level window first (cheap, indexed), then exact combined-instant overlap in memory.
  const candidates = await prisma.dayPlanEntry.findMany({
    where: { userId, date: { lte: endDate }, endDate: { gte: date }, id: excludeEntryId ? { not: excludeEntryId } : undefined },
  });
  return candidates.filter((e) => entriesOverlap(date, startTime, endDate, endTime, e.date, e.startTime, e.endDate, e.endTime));
}

function toOverlapInfo(e: DayPlanEntry): OverlapInfo {
  return { date: dateKey(e.date), endDate: dateKey(e.endDate), title: e.title, startTime: e.startTime, endTime: e.endTime };
}

type EntryTemplateInput = {
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  /** True when the block crosses midnight, i.e. its end day is one day after its start day. */
  endsNextDay?: boolean;
  category: DayPlanEntry["category"];
  priority: DayPlanEntry["priority"];
  color: string;
  icon: string;
  location?: string | null;
  link?: string | null;
  notes?: string | null;
  reminderMinutes?: number | null;
  linkedRoutineId?: string | null;
  linkedGroupRoutineId?: string | null;
};

/** Validates a fully-resolved (date, startTime, endDate, endTime) combination. This is the
 * ONLY place "is this a valid time range" is decided -- callers must never fall back to a
 * bare `endTime > startTime` string comparison, which breaks for anything crossing
 * midnight. */
function assertValidEntryRange(date: Date, startTime: string, endDate: Date, endTime: string) {
  if (endDate < date) {
    throw new DayPlanError("Das Enddatum darf nicht vor dem Startdatum liegen.", "INVALID_END_DATE");
  }
  if (combinedMinutes(endDate, endTime) <= combinedMinutes(date, startTime)) {
    throw new DayPlanError(
      "Das Ende muss nach dem Start liegen. Wähle bei einer Planung über Mitternacht den nächsten Tag als Enddatum.",
      "END_BEFORE_START"
    );
  }
  const days = Math.round((endDate.getTime() - date.getTime()) / 86400000);
  if (days > 14) {
    throw new DayPlanError("Ein Zeitblock darf höchstens 14 Tage dauern.", "END_BEFORE_START");
  }
}

/** Picks the entry that best represents "what this recurring block currently looks like"
 * out of every occurrence in its series. Prefers the earliest FUTURE (>= today)
 * not-customized occurrence -- future entries reflect the series' current, up-to-date
 * shape (past entries are deliberately never touched by a template-level edit, see
 * updateSeriesBlock, so a past occurrence can carry stale pre-edit values and must never be
 * used as "the template"). Falls back to the earliest non-customized occurrence of any date
 * if none of the series' future entries are still on-template, and finally to the earliest
 * occurrence overall if every single one has been individually customized. */
function pickSeriesTemplate(entries: DayPlanEntry[], today: Date): DayPlanEntry {
  const byDateAsc = entries.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
  const nonCustomized = byDateAsc.filter((e) => !e.isCustomized);
  const futureNonCustomized = nonCustomized.filter((e) => e.date >= today);
  return (futureNonCustomized[0] ?? nonCustomized[0] ?? byDateAsc[0])!;
}

async function assertOwnedLinks(userId: string, linkedRoutineId?: string | null, linkedGroupRoutineId?: string | null) {
  if (linkedRoutineId) {
    const routine = await prisma.routine.findUnique({ where: { id: linkedRoutineId } });
    if (!routine || routine.userId !== userId) throw new DayPlanError("Routine nicht gefunden.", "NOT_FOUND");
  }
  if (linkedGroupRoutineId) {
    const participant = await prisma.groupRoutineParticipant.findUnique({
      where: { groupRoutineId_userId: { groupRoutineId: linkedGroupRoutineId, userId } },
    });
    if (!participant || participant.status !== "JOINED") {
      throw new DayPlanError("Du nimmst an dieser Gruppenroutine nicht teil.", "NOT_FOUND");
    }
  }
}

// ---------- DayPlan (container) ----------

export async function createDayPlan(
  userId: string,
  input: {
    title: string;
    description?: string | null;
    startDate: string;
    endDate: string;
    color: string;
    icon: string;
    recurrenceType: DayPlanRecurrenceType;
    recurrenceDays?: number[];
    reminderMinutes?: number | null;
    entries: EntryTemplateInput[];
  }
) {
  const startDate = parseDateKey(input.startDate);
  const endDate = parseDateKey(input.endDate);
  assertValidRange(startDate, endDate);
  const recurrenceType = input.recurrenceType === "SINGLE_DAY" && dateKey(startDate) !== dateKey(endDate) ? "EVERY_DAY" : input.recurrenceType;
  const recurrenceDays = input.recurrenceDays ?? [];
  const dates = generateDayPlanDates(startDate, endDate, recurrenceType, recurrenceDays);

  for (const e of input.entries) {
    assertValidEntryRange(startDate, e.startTime, e.endsNextDay ? addDaysUtc(startDate, 1) : startDate, e.endTime);
    await assertOwnedLinks(userId, e.linkedRoutineId, e.linkedGroupRoutineId);
  }

  if (dates.length * Math.max(1, input.entries.length) > 1000) {
    throw new DayPlanError("Zu viele Einträge auf einmal. Bitte Zeitraum oder Anzahl der Zeitblöcke reduzieren.", "RANGE_TOO_LARGE");
  }

  const dayPlan = await prisma.dayPlan.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      startDate,
      endDate,
      color: input.color,
      icon: input.icon,
      recurrenceType,
      recurrenceDays,
      reminderMinutes: input.reminderMinutes ?? null,
    },
  });

  const overlaps: OverlapInfo[] = [];
  const createdEntries: DayPlanEntry[] = [];

  if (dates.length > 0 && input.entries.length > 0) {
    const existing = await prisma.dayPlanEntry.findMany({
      where: { userId, date: { lte: addDaysUtc(dates[dates.length - 1], 1) }, endDate: { gte: dates[0] } },
    });

    for (const e of input.entries) {
      const seriesId = randomUUID();
      const rows: Prisma.DayPlanEntryCreateManyInput[] = dates.map((date) => {
        const entryEndDate = e.endsNextDay ? addDaysUtc(date, 1) : date;
        const conflicts = existing.filter((ex) => entriesOverlap(date, e.startTime, entryEndDate, e.endTime, ex.date, ex.startTime, ex.endDate, ex.endTime));
        for (const c of conflicts) overlaps.push(toOverlapInfo(c));
        return {
          userId,
          dayPlanId: dayPlan.id,
          seriesId,
          date,
          endDate: entryEndDate,
          title: e.title,
          description: e.description ?? null,
          startTime: e.startTime,
          endTime: e.endTime,
          category: e.category,
          priority: e.priority,
          color: e.color,
          icon: e.icon,
          location: e.location ?? null,
          link: e.link ?? null,
          notes: e.notes ?? null,
          reminderMinutes: e.reminderMinutes ?? input.reminderMinutes ?? null,
          linkedRoutineId: e.linkedRoutineId ?? null,
          linkedGroupRoutineId: e.linkedGroupRoutineId ?? null,
        };
      });
      await prisma.dayPlanEntry.createMany({ data: rows });
    }
    createdEntries.push(...(await prisma.dayPlanEntry.findMany({ where: { dayPlanId: dayPlan.id }, orderBy: [{ date: "asc" }, { startTime: "asc" }] })));
  }

  return { dayPlan, entries: createdEntries, overlaps };
}

export async function listDayPlans(userId: string) {
  return prisma.dayPlan.findMany({ where: { userId, archived: false }, orderBy: { startDate: "desc" } });
}

export async function getDayPlan(userId: string, dayPlanId: string) {
  const plan = await prisma.dayPlan.findUnique({
    where: { id: dayPlanId },
    include: { entries: { orderBy: [{ date: "asc" }, { sortOrder: "asc" }, { startTime: "asc" }] } },
  });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");
  return plan;
}

/** Regenerates future (>= today) series occurrences to match a DayPlan's new
 * startDate/endDate/recurrence after a schedule edit. Past entries are never touched. For
 * each recurring block (seriesId group): future dates that were expected under the OLD
 * schedule but not the new one are removed (unless the occurrence was individually
 * customized -- those are always kept, see `isCustomized`); future dates newly expected
 * under the NEW schedule that don't already have an entry are created, cloned from the
 * series' template (its earliest non-customized entry). Occurrences whose date is expected
 * under both schedules are left completely alone. */
async function syncFutureSeriesEntries(
  userId: string,
  dayPlanId: string,
  oldPlan: { startDate: Date; endDate: Date; recurrenceType: DayPlanRecurrenceType; recurrenceDays: number[] },
  next: { startDate: Date; endDate: Date; recurrenceType: DayPlanRecurrenceType; recurrenceDays: number[] }
): Promise<{ addedCount: number; removedCount: number; keptCustomizedCount: number; overlaps: OverlapInfo[] }> {
  const today = todayDateOnly();
  const allEntries = await prisma.dayPlanEntry.findMany({ where: { dayPlanId, userId } });
  const bySeries = new Map<string, DayPlanEntry[]>();
  for (const e of allEntries) {
    if (!e.seriesId) continue;
    const arr = bySeries.get(e.seriesId) ?? [];
    arr.push(e);
    bySeries.set(e.seriesId, arr);
  }

  const oldDates = generateDayPlanDates(oldPlan.startDate, oldPlan.endDate, oldPlan.recurrenceType, oldPlan.recurrenceDays);
  const newDates = generateDayPlanDates(next.startDate, next.endDate, next.recurrenceType, next.recurrenceDays);
  const todayKey = dateKey(today);
  const oldFutureKeys = new Set(oldDates.map(dateKey).filter((k) => k >= todayKey));
  const newFutureKeys = new Set(newDates.map(dateKey).filter((k) => k >= todayKey));

  let addedCount = 0;
  let removedCount = 0;
  let keptCustomizedCount = 0;
  const toDelete: string[] = [];
  const toCreate: Prisma.DayPlanEntryCreateManyInput[] = [];

  for (const seriesEntries of bySeries.values()) {
    const sorted = seriesEntries.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
    const template = pickSeriesTemplate(seriesEntries, today);
    const seriesId = template.seriesId!;
    const dayOffset = Math.round((template.endDate.getTime() - template.date.getTime()) / 86400000);
    const byDateKey = new Map(sorted.map((e) => [dateKey(e.date), e]));

    for (const k of oldFutureKeys) {
      if (newFutureKeys.has(k)) continue;
      const e = byDateKey.get(k);
      if (!e) continue;
      if (e.isCustomized) {
        keptCustomizedCount++;
        continue;
      }
      toDelete.push(e.id);
      removedCount++;
    }

    for (const k of newFutureKeys) {
      if (byDateKey.has(k)) continue;
      const date = parseDateKey(k);
      const entryEndDate = addDaysUtc(date, dayOffset);
      toCreate.push({
        userId,
        dayPlanId,
        seriesId,
        date,
        endDate: entryEndDate,
        title: template.title,
        description: template.description,
        startTime: template.startTime,
        endTime: template.endTime,
        sortOrder: template.sortOrder,
        category: template.category,
        priority: template.priority,
        color: template.color,
        icon: template.icon,
        location: template.location,
        link: template.link,
        notes: template.notes,
        reminderMinutes: template.reminderMinutes,
        linkedRoutineId: template.linkedRoutineId,
        linkedGroupRoutineId: template.linkedGroupRoutineId,
      });
      addedCount++;
    }
  }

  if (toDelete.length) {
    await prisma.dayPlanEntry.deleteMany({ where: { id: { in: toDelete } } });
  }
  const overlaps: OverlapInfo[] = [];
  if (toCreate.length) {
    const stillExisting = await prisma.dayPlanEntry.findMany({
      where: { userId, date: { lte: next.endDate }, endDate: { gte: next.startDate }, id: { notIn: toDelete } },
    });
    for (const row of toCreate) {
      const conflicts = stillExisting.filter((ex) =>
        entriesOverlap(row.date as Date, row.startTime as string, row.endDate as Date, row.endTime as string, ex.date, ex.startTime, ex.endDate, ex.endTime)
      );
      for (const c of conflicts) overlaps.push(toOverlapInfo(c));
    }
    await prisma.dayPlanEntry.createMany({ data: toCreate });
  }

  return { addedCount, removedCount, keptCustomizedCount, overlaps };
}

/** Full DayPlan metadata edit, including its date range/recurrence/timezone. Past entries
 * (date < today) are never touched by this function under any circumstances. When the
 * schedule (date range and/or recurrence) actually changes and `syncFutureEntries` is
 * requested, future occurrences of every recurring block are reconciled to match the new
 * schedule: occurrences no longer expected are removed, newly-expected ones are created
 * from the block's template -- except individually customized occurrences
 * (`isCustomized`), which are always preserved regardless of the new schedule. Without
 * `syncFutureEntries` (the default), only the DayPlan container's own fields change and
 * already-materialized entries are left completely alone -- the original, more
 * conservative behavior, still used by callers that only want to rename/recolor a plan. */
export async function updateDayPlan(
  userId: string,
  dayPlanId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    startDate: string;
    endDate: string;
    timeZone: string;
    color: string;
    icon: string;
    recurrenceType: DayPlanRecurrenceType;
    recurrenceDays: number[];
    reminderMinutes: number | null;
    archived: boolean;
  }>,
  opts: { syncFutureEntries?: boolean } = {}
) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");

  const newStart = patch.startDate ? parseDateKey(patch.startDate) : plan.startDate;
  const newEnd = patch.endDate ? parseDateKey(patch.endDate) : plan.endDate;
  if (patch.startDate || patch.endDate) assertValidRange(newStart, newEnd);
  const newRecurrenceType = patch.recurrenceType ?? plan.recurrenceType;
  const newRecurrenceDays = patch.recurrenceDays ?? plan.recurrenceDays;

  const scheduleChanged =
    dateKey(newStart) !== dateKey(plan.startDate) ||
    dateKey(newEnd) !== dateKey(plan.endDate) ||
    newRecurrenceType !== plan.recurrenceType ||
    JSON.stringify([...newRecurrenceDays].sort((a, b) => a - b)) !== JSON.stringify([...plan.recurrenceDays].sort((a, b) => a - b));

  let sync: { addedCount: number; removedCount: number; keptCustomizedCount: number; overlaps: OverlapInfo[] } | null = null;
  if (opts.syncFutureEntries && scheduleChanged) {
    sync = await syncFutureSeriesEntries(
      userId,
      dayPlanId,
      plan,
      { startDate: newStart, endDate: newEnd, recurrenceType: newRecurrenceType, recurrenceDays: newRecurrenceDays }
    );
  }

  const data: Prisma.DayPlanUpdateInput = {
    title: patch.title,
    description: patch.description,
    timeZone: patch.timeZone,
    color: patch.color,
    icon: patch.icon,
    recurrenceType: newRecurrenceType,
    recurrenceDays: newRecurrenceDays,
    reminderMinutes: patch.reminderMinutes,
    archived: patch.archived,
    startDate: newStart,
    endDate: newEnd,
  };

  const updated = await prisma.dayPlan.update({ where: { id: dayPlanId }, data });
  return { plan: updated, sync };
}

export async function deleteDayPlan(userId: string, dayPlanId: string) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");
  await prisma.dayPlan.delete({ where: { id: dayPlanId } });
}

export async function addEntryToPlan(userId: string, dayPlanId: string, e: EntryTemplateInput) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");
  assertValidEntryRange(plan.startDate, e.startTime, e.endsNextDay ? addDaysUtc(plan.startDate, 1) : plan.startDate, e.endTime);
  await assertOwnedLinks(userId, e.linkedRoutineId, e.linkedGroupRoutineId);

  const dates = generateDayPlanDates(plan.startDate, plan.endDate, plan.recurrenceType, plan.recurrenceDays);
  const existing = dates.length
    ? await prisma.dayPlanEntry.findMany({ where: { userId, date: { lte: addDaysUtc(dates[dates.length - 1], 1) }, endDate: { gte: dates[0] } } })
    : [];
  const overlaps: OverlapInfo[] = [];
  const seriesId = randomUUID();
  const rows: Prisma.DayPlanEntryCreateManyInput[] = dates.map((date) => {
    const entryEndDate = e.endsNextDay ? addDaysUtc(date, 1) : date;
    const conflicts = existing.filter((ex) => entriesOverlap(date, e.startTime, entryEndDate, e.endTime, ex.date, ex.startTime, ex.endDate, ex.endTime));
    for (const c of conflicts) overlaps.push(toOverlapInfo(c));
    return {
      userId,
      dayPlanId: plan.id,
      seriesId,
      date,
      endDate: entryEndDate,
      title: e.title,
      description: e.description ?? null,
      startTime: e.startTime,
      endTime: e.endTime,
      category: e.category,
      priority: e.priority,
      color: e.color,
      icon: e.icon,
      location: e.location ?? null,
      link: e.link ?? null,
      notes: e.notes ?? null,
      reminderMinutes: e.reminderMinutes ?? plan.reminderMinutes ?? null,
      linkedRoutineId: e.linkedRoutineId ?? null,
      linkedGroupRoutineId: e.linkedGroupRoutineId ?? null,
    };
  });
  await prisma.dayPlanEntry.createMany({ data: rows });
  const entries = await prisma.dayPlanEntry.findMany({ where: { dayPlanId: plan.id, seriesId }, orderBy: { date: "asc" } });
  return { entries, overlaps };
}

// ---------- Series-block overview & editing ----------
// A recurring DayPlan block is materialized as one DayPlanEntry row per matching calendar
// day, all sharing one `seriesId` (assigned once per block when it's added to the plan --
// see createDayPlan/addEntryToPlan above). Editing "the whole plan" should feel like
// editing a short list of blocks (one row per seriesId), not a wall of individual dated
// entries -- `getDayPlanOverview` collapses each series back down to that single
// "template" (its earliest non-customized occurrence stands in for the shape everyone else
// in the series shares) plus small summaries of what has diverged from it.

export type SeriesBlockOverview = {
  seriesId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  category: DayPlanEntry["category"];
  priority: DayPlanEntry["priority"];
  color: string;
  icon: string;
  location: string | null;
  link: string | null;
  notes: string | null;
  reminderMinutes: number | null;
  linkedRoutineId: string | null;
  linkedGroupRoutineId: string | null;
  sortOrder: number;
  totalCount: number;
  futureCount: number;
  pastCount: number;
  customizedDays: Array<{ entryId: string; date: string; title: string }>;
  missingDays: string[];
};

export async function getDayPlanOverview(userId: string, dayPlanId: string) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId }, include: { entries: true } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");

  const expectedKeys = generateDayPlanDates(plan.startDate, plan.endDate, plan.recurrenceType, plan.recurrenceDays).map(dateKey);
  const today = todayDateOnly();
  const todayKey = dateKey(today);

  const bySeries = new Map<string, DayPlanEntry[]>();
  const extras: DayPlanEntry[] = [];
  for (const e of plan.entries) {
    if (e.seriesId) {
      const arr = bySeries.get(e.seriesId) ?? [];
      arr.push(e);
      bySeries.set(e.seriesId, arr);
    } else {
      extras.push(e);
    }
  }

  const blocks: SeriesBlockOverview[] = [...bySeries.entries()]
    .map(([seriesId, seriesEntries]) => {
      const sorted = seriesEntries.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
      const template = pickSeriesTemplate(seriesEntries, today);
      const actualKeys = new Set(sorted.map((e) => dateKey(e.date)));
      const customizedDays = sorted
        .filter((e) => e.isCustomized)
        .map((e) => ({ entryId: e.id, date: dateKey(e.date), title: e.title }));
      const missingDays = expectedKeys.filter((k) => k >= todayKey && !actualKeys.has(k));
      const futureCount = sorted.filter((e) => dateKey(e.date) >= todayKey).length;
      return {
        seriesId,
        title: template.title,
        description: template.description,
        startTime: template.startTime,
        endTime: template.endTime,
        endsNextDay: template.endDate.getTime() !== template.date.getTime(),
        category: template.category,
        priority: template.priority,
        color: template.color,
        icon: template.icon,
        location: template.location,
        link: template.link,
        notes: template.notes,
        reminderMinutes: template.reminderMinutes,
        linkedRoutineId: template.linkedRoutineId,
        linkedGroupRoutineId: template.linkedGroupRoutineId,
        sortOrder: template.sortOrder,
        totalCount: sorted.length,
        futureCount,
        pastCount: sorted.length - futureCount,
        customizedDays,
        missingDays,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.startTime.localeCompare(b.startTime));

  return { plan, blocks, extras, expectedOccurrenceCount: expectedKeys.length };
}

export type SeriesBlockPatch = Partial<{
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  category: DayPlanEntry["category"];
  priority: DayPlanEntry["priority"];
  color: string;
  icon: string;
  location: string | null;
  link: string | null;
  notes: string | null;
  reminderMinutes: number | null;
  linkedRoutineId: string | null;
  linkedGroupRoutineId: string | null;
}>;

/** Edits every future (>= today), not-yet-customized occurrence of one recurring block at
 * once -- the "edit the template" operation behind the compact plan editor. Past
 * occurrences are never touched. Individually customized occurrences are skipped by
 * default (their per-day adjustment is preserved) unless `includeCustomized` is set, in
 * which case they're overwritten and revert to following the series again. */
export async function updateSeriesBlock(
  userId: string,
  dayPlanId: string,
  seriesId: string,
  patch: SeriesBlockPatch,
  opts: { includeCustomized?: boolean } = {}
) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");
  if (patch.linkedRoutineId !== undefined || patch.linkedGroupRoutineId !== undefined) {
    await assertOwnedLinks(userId, patch.linkedRoutineId, patch.linkedGroupRoutineId);
  }

  const today = todayDateOnly();
  const where: Prisma.DayPlanEntryWhereInput = { dayPlanId, seriesId, userId, date: { gte: today } };
  if (!opts.includeCustomized) where.isCustomized = false;
  const targets = await prisma.dayPlanEntry.findMany({ where });
  if (targets.length === 0) {
    throw new DayPlanError("Kein zukünftiger Termin für diesen Zeitblock gefunden.", "ENTRY_NOT_FOUND");
  }

  const { endsNextDay, startTime: patchStart, endTime: patchEnd, ...rest } = patch;
  const updated: DayPlanEntry[] = [];
  for (const e of targets) {
    const dayOffset = Math.round((e.endDate.getTime() - e.date.getTime()) / 86400000);
    const newStartTime = patchStart ?? e.startTime;
    const newEndTime = patchEnd ?? e.endTime;
    const newEndDate = endsNextDay !== undefined ? addDaysUtc(e.date, endsNextDay ? 1 : 0) : addDaysUtc(e.date, dayOffset);
    assertValidEntryRange(e.date, newStartTime, newEndDate, newEndTime);

    const data: Prisma.DayPlanEntryUncheckedUpdateInput = {
      title: rest.title,
      description: rest.description,
      category: rest.category,
      priority: rest.priority,
      color: rest.color,
      icon: rest.icon,
      location: rest.location,
      link: rest.link,
      notes: rest.notes,
      reminderMinutes: rest.reminderMinutes,
      linkedRoutineId: rest.linkedRoutineId,
      linkedGroupRoutineId: rest.linkedGroupRoutineId,
      startTime: newStartTime,
      endTime: newEndTime,
      endDate: newEndDate,
      // A template-level edit re-aligns the occurrence with its series -- if it was
      // customized and got included anyway (`includeCustomized`), it now matches the
      // template again and stops counting as an exception.
      isCustomized: opts.includeCustomized ? false : undefined,
    };
    updated.push(await prisma.dayPlanEntry.update({ where: { id: e.id }, data }));
  }

  const overlaps: OverlapInfo[] = [];
  for (const u of updated) {
    const conflicts = await findOverlappingEntries(userId, u.date, u.startTime, u.endDate, u.endTime, u.id);
    for (const c of conflicts) overlaps.push(toOverlapInfo(c));
  }

  const keptCustomizedCount = opts.includeCustomized
    ? 0
    : await prisma.dayPlanEntry.count({ where: { dayPlanId, seriesId, userId, date: { gte: today }, isCustomized: true } });

  return { updatedCount: updated.length, keptCustomizedCount, overlaps };
}

/** Removes every future (>= today), not-yet-customized occurrence of one recurring block.
 * Past occurrences are always kept (so history/stats stay intact); customized ones are
 * kept unless `includeCustomized` is set. */
export async function deleteSeriesBlock(userId: string, dayPlanId: string, seriesId: string, opts: { includeCustomized?: boolean } = {}) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");

  const today = todayDateOnly();
  const where: Prisma.DayPlanEntryWhereInput = { dayPlanId, seriesId, userId, date: { gte: today } };
  if (!opts.includeCustomized) where.isCustomized = false;
  const targets = await prisma.dayPlanEntry.findMany({ where });
  await prisma.dayPlanEntry.deleteMany({ where: { id: { in: targets.map((e) => e.id) } } });

  const keptCustomizedCount = opts.includeCustomized
    ? 0
    : await prisma.dayPlanEntry.count({ where: { dayPlanId, seriesId, userId, date: { gte: today }, isCustomized: true } });

  return { deletedCount: targets.length, keptCustomizedCount };
}

/** Reorders whole blocks (all occurrences of each seriesId, including past ones -- display
 * order is cosmetic, not stats-affecting, so there's no reason to protect history from
 * it). `orderedSeriesIds` must list every seriesId currently in the plan. */
export async function reorderSeriesBlocks(userId: string, dayPlanId: string, orderedSeriesIds: string[]) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");
  await Promise.all(
    orderedSeriesIds.map((seriesId, i) => prisma.dayPlanEntry.updateMany({ where: { dayPlanId, seriesId, userId }, data: { sortOrder: i } }))
  );
}

/** Re-aligns one customized occurrence back to what the rest of its series looks like
 * (its own date/status are kept -- only the block's "shape" is restored). */
export async function resetEntryToTemplate(userId: string, entryId: string) {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "ENTRY_NOT_FOUND");
  if (!entry.seriesId) throw new DayPlanError("Dieser Eintrag gehört zu keiner Serie.", "ENTRY_NOT_FOUND");

  const siblings = await prisma.dayPlanEntry.findMany({ where: { seriesId: entry.seriesId, userId, id: { not: entry.id } } });
  if (siblings.every((e) => e.isCustomized)) throw new DayPlanError("Keine ursprüngliche Vorlage für diesen Zeitblock gefunden.", "ENTRY_NOT_FOUND");
  const template = pickSeriesTemplate(siblings, todayDateOnly());

  const dayOffset = Math.round((template.endDate.getTime() - template.date.getTime()) / 86400000);
  const newEndDate = addDaysUtc(entry.date, dayOffset);
  assertValidEntryRange(entry.date, template.startTime, newEndDate, template.endTime);

  const updated = await prisma.dayPlanEntry.update({
    where: { id: entryId },
    data: {
      title: template.title,
      description: template.description,
      startTime: template.startTime,
      endTime: template.endTime,
      endDate: newEndDate,
      category: template.category,
      priority: template.priority,
      color: template.color,
      icon: template.icon,
      location: template.location,
      link: template.link,
      notes: template.notes,
      reminderMinutes: template.reminderMinutes,
      linkedRoutineId: template.linkedRoutineId,
      linkedGroupRoutineId: template.linkedGroupRoutineId,
      isCustomized: false,
    },
  });
  return { entry: updated };
}

/** Recreates a series occurrence that was deleted for just one day (a "missing day"
 * exception), cloned from the series' current template. */
export async function restoreSeriesOccurrence(userId: string, dayPlanId: string, seriesId: string, dateStr: string) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");

  const date = parseDateKey(dateStr);
  const existing = await prisma.dayPlanEntry.findFirst({ where: { seriesId, userId, date } });
  if (existing) throw new DayPlanError("An diesem Tag existiert bereits ein Eintrag für diesen Zeitblock.", "TIME_OVERLAP");

  const siblings = await prisma.dayPlanEntry.findMany({ where: { seriesId, userId } });
  if (siblings.length === 0) throw new DayPlanError("Keine Vorlage für diese Serie gefunden.", "ENTRY_NOT_FOUND");
  const template = pickSeriesTemplate(siblings, todayDateOnly());

  const dayOffset = Math.round((template.endDate.getTime() - template.date.getTime()) / 86400000);
  const endDate = addDaysUtc(date, dayOffset);
  assertValidEntryRange(date, template.startTime, endDate, template.endTime);
  const overlaps = (await findOverlappingEntries(userId, date, template.startTime, endDate, template.endTime)).map(toOverlapInfo);

  const created = await prisma.dayPlanEntry.create({
    data: {
      userId,
      dayPlanId,
      seriesId,
      date,
      endDate,
      title: template.title,
      description: template.description,
      startTime: template.startTime,
      endTime: template.endTime,
      sortOrder: template.sortOrder,
      category: template.category,
      priority: template.priority,
      color: template.color,
      icon: template.icon,
      location: template.location,
      link: template.link,
      notes: template.notes,
      reminderMinutes: template.reminderMinutes,
      linkedRoutineId: template.linkedRoutineId,
      linkedGroupRoutineId: template.linkedGroupRoutineId,
    },
  });
  return { entry: created, overlaps };
}

/** "Zukünftige Serie beenden": stops the plan from having any more future occurrences from
 * today onward, without touching past entries or history. Removes future non-customized
 * entries (customized ones are kept) and clamps the plan's own endDate so it can't
 * generate any more via `addEntryToPlan`/schedule syncs either. */
export async function endDayPlanSeries(userId: string, dayPlanId: string) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");

  const today = todayDateOnly();
  const yesterday = addDaysUtc(today, -1);
  const removable = await prisma.dayPlanEntry.findMany({ where: { dayPlanId, userId, date: { gte: today }, isCustomized: false } });
  if (removable.length) await prisma.dayPlanEntry.deleteMany({ where: { id: { in: removable.map((e) => e.id) } } });
  const keptCustomizedCount = await prisma.dayPlanEntry.count({ where: { dayPlanId, userId, date: { gte: today }, isCustomized: true } });

  // Clamp endDate to "yesterday" so no future occurrence can be generated again -- but
  // never push it below startDate (a plan that hasn't started yet just collapses to a
  // single day) or above its current endDate (this action only ever shortens a plan).
  const cappedEnd = yesterday >= plan.startDate ? yesterday : plan.startDate;
  const newEndDate = plan.endDate < cappedEnd ? plan.endDate : cappedEnd;
  const updated = await prisma.dayPlan.update({ where: { id: dayPlanId }, data: { endDate: newEndDate } });

  return { plan: updated, removedCount: removable.length, keptCustomizedCount };
}

// ---------- Standalone / single entries ----------

export async function createStandaloneEntry(userId: string, input: EntryTemplateInput & { date: string; endDate?: string }) {
  const date = parseDateKey(input.date);
  const endDate = input.endDate ? parseDateKey(input.endDate) : input.endsNextDay ? addDaysUtc(date, 1) : date;
  assertValidEntryRange(date, input.startTime, endDate, input.endTime);
  await assertOwnedLinks(userId, input.linkedRoutineId, input.linkedGroupRoutineId);
  const overlaps = (await findOverlappingEntries(userId, date, input.startTime, endDate, input.endTime)).map(toOverlapInfo);
  const entry = await prisma.dayPlanEntry.create({
    data: {
      userId,
      date,
      endDate,
      title: input.title,
      description: input.description ?? null,
      startTime: input.startTime,
      endTime: input.endTime,
      category: input.category,
      priority: input.priority,
      color: input.color,
      icon: input.icon,
      location: input.location ?? null,
      link: input.link ?? null,
      notes: input.notes ?? null,
      reminderMinutes: input.reminderMinutes ?? null,
      linkedRoutineId: input.linkedRoutineId ?? null,
      linkedGroupRoutineId: input.linkedGroupRoutineId ?? null,
    },
  });
  return { entry, overlaps };
}

export async function duplicateEntry(userId: string, entryId: string, newDate?: string) {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "ENTRY_NOT_FOUND");

  const dayOffset = Math.round((entry.endDate.getTime() - entry.date.getTime()) / 86400000);
  const date = newDate ? parseDateKey(newDate) : entry.date;
  const endDate = addDaysUtc(date, dayOffset);
  const overlaps = (await findOverlappingEntries(userId, date, entry.startTime, endDate, entry.endTime)).map(toOverlapInfo);

  const created = await prisma.dayPlanEntry.create({
    data: {
      userId,
      date,
      endDate,
      title: entry.title,
      description: entry.description,
      startTime: entry.startTime,
      endTime: entry.endTime,
      category: entry.category,
      priority: entry.priority,
      color: entry.color,
      icon: entry.icon,
      location: entry.location,
      link: entry.link,
      notes: entry.notes,
      reminderMinutes: entry.reminderMinutes,
      // Deliberately not carried over: dayPlanId/seriesId (a duplicate is a standalone
      // one-off, not silently re-attached to the original recurring series) and
      // linkedRoutineId/linkedGroupRoutineId (copying a routine link would let completing
      // the duplicate re-trigger the same routine's completion a second time for that day).
    },
  });
  return { entry: created, overlaps };
}

export async function getEntriesForRange(userId: string, startDate: Date, endDate: Date) {
  // Interval overlap, not a simple `date BETWEEN`: an overnight entry that started the day
  // before `startDate` but ends inside the range (or vice versa) must still be included so
  // both affected days can render their half of it.
  return prisma.dayPlanEntry.findMany({
    where: { userId, date: { lte: endDate }, endDate: { gte: startDate } },
    orderBy: [{ date: "asc" }, { sortOrder: "asc" }, { startTime: "asc" }],
  });
}

export async function getDayBoard(userId: string, day: Date) {
  const entries = await prisma.dayPlanEntry.findMany({ where: { userId, date: { lte: day }, endDate: { gte: day } }, orderBy: { startTime: "asc" } });
  const total = entries.length;
  const done = entries.filter((e) => e.status === "DONE").length;
  const skipped = entries.filter((e) => e.status === "SKIPPED").length;
  const open = total - done - skipped;
  const plannedMinutes = entries.reduce((sum, e) => sum + entryDurationMinutes(e.date, e.startTime, e.endDate, e.endTime), 0);
  const doneMinutes = entries.filter((e) => e.status === "DONE").reduce((sum, e) => sum + entryDurationMinutes(e.date, e.startTime, e.endDate, e.endTime), 0);
  return {
    entries,
    stats: {
      total,
      done,
      open,
      skipped,
      plannedMinutes,
      doneMinutes,
      freeMinutes: Math.max(0, 24 * 60 - plannedMinutes),
      progressRatio: total > 0 ? done / total : 0,
    },
  };
}

// ---------- Edit / delete with recurrence scope ----------

type Scope = "THIS" | "FOLLOWING" | "ALL";

async function resolveScopeTargets(userId: string, entry: DayPlanEntry, scope: Scope): Promise<DayPlanEntry[]> {
  if (scope === "THIS" || !entry.seriesId) return [entry];
  const seriesEntries = await prisma.dayPlanEntry.findMany({ where: { userId, seriesId: entry.seriesId } });
  return scope === "ALL" ? seriesEntries : seriesEntries.filter((e) => e.date >= entry.date);
}

export type EntryPatch = Partial<{
  title: string;
  description: string | null;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  category: DayPlanEntry["category"];
  priority: DayPlanEntry["priority"];
  color: string;
  icon: string;
  location: string | null;
  link: string | null;
  notes: string | null;
  reminderMinutes: number | null;
  sortOrder: number;
  linkedRoutineId: string | null;
  linkedGroupRoutineId: string | null;
}>;

export async function updateEntry(
  userId: string,
  entryId: string,
  patch: EntryPatch,
  scope: Scope = "THIS",
  opts: { includeCustomized?: boolean } = {}
) {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "ENTRY_NOT_FOUND");
  if (patch.linkedRoutineId !== undefined || patch.linkedGroupRoutineId !== undefined) {
    await assertOwnedLinks(userId, patch.linkedRoutineId, patch.linkedGroupRoutineId);
  }

  const targets = await resolveScopeTargets(userId, entry, scope);
  const today = todayDateOnly();
  // Never silently rewrite history: past days are always excluded from bulk scope edits.
  const notPast = targets.filter((e) => e.date >= today || e.id === entry.id);
  const skippedPast = targets.length - notPast.length;
  // A FOLLOWING/ALL bulk edit must not silently overwrite days the user already
  // individually customized -- unless explicitly told to (`includeCustomized`). The
  // directly-targeted entry is always editable regardless, even if it's itself customized.
  const protectCustomized = scope !== "THIS" && !opts.includeCustomized;
  const editable = protectCustomized ? notPast.filter((e) => !e.isCustomized || e.id === entry.id) : notPast;
  const skippedCustomized = notPast.length - editable.length;

  const { date: patchDate, endDate: patchEndDate, endsNextDay, ...rest } = patch;
  const updated: DayPlanEntry[] = [];
  for (const e of editable) {
    const dayOffset = Math.round((e.endDate.getTime() - e.date.getTime()) / 86400000);
    // Explicit date/endDate overrides only apply to a single-entry (THIS scope) edit --
    // applying one literal date across a whole series of different-dated occurrences would
    // collapse them onto the same day. Bulk edits instead recompute each occurrence's own
    // end day from its own start day, preserving the block's day-span (or the explicit
    // `endsNextDay` toggle when provided).
    const isSingleEntry = scope === "THIS" || !entry.seriesId || editable.length === 1;
    const newDate = isSingleEntry && patchDate ? parseDateKey(patchDate) : e.date;
    const newStartTime = rest.startTime ?? e.startTime;
    const newEndTime = rest.endTime ?? e.endTime;
    const newEndDate =
      isSingleEntry && patchEndDate
        ? parseDateKey(patchEndDate)
        : endsNextDay !== undefined
        ? addDaysUtc(newDate, endsNextDay ? 1 : 0)
        : addDaysUtc(newDate, dayOffset);

    assertValidEntryRange(newDate, newStartTime, newEndDate, newEndTime);

    const data: Prisma.DayPlanEntryUncheckedUpdateInput = {
      title: rest.title,
      description: rest.description,
      category: rest.category,
      priority: rest.priority,
      color: rest.color,
      icon: rest.icon,
      location: rest.location,
      link: rest.link,
      notes: rest.notes,
      reminderMinutes: rest.reminderMinutes,
      sortOrder: rest.sortOrder,
      linkedRoutineId: rest.linkedRoutineId,
      linkedGroupRoutineId: rest.linkedGroupRoutineId,
      date: newDate,
      endDate: newEndDate,
      startTime: newStartTime,
      endTime: newEndTime,
      // Explicitly editing just "this" occurrence of a recurring series marks it as an
      // intentional per-day exception, so later template-level edits skip it by default
      // (see updateSeriesBlock) instead of silently clobbering the adjustment. A
      // FOLLOWING/ALL edit re-aligns entries with the series, so it clears the flag.
      isCustomized: scope === "THIS" && entry.seriesId ? true : scope !== "THIS" ? false : undefined,
    };
    updated.push(await prisma.dayPlanEntry.update({ where: { id: e.id }, data }));
  }

  return { updated, skippedPast, skippedCustomized };
}

export async function deleteEntry(userId: string, entryId: string, scope: Scope = "THIS", opts: { includeCustomized?: boolean } = {}) {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "ENTRY_NOT_FOUND");

  const targets = await resolveScopeTargets(userId, entry, scope);
  const today = todayDateOnly();
  const notPast = targets.filter((e) => e.date >= today || e.id === entry.id);
  const skippedPast = targets.length - notPast.length;
  const protectCustomized = scope !== "THIS" && !opts.includeCustomized;
  const editable = protectCustomized ? notPast.filter((e) => !e.isCustomized || e.id === entry.id) : notPast;
  const skippedCustomized = notPast.length - editable.length;

  await prisma.dayPlanEntry.deleteMany({ where: { id: { in: editable.map((e) => e.id) } } });
  return { deletedCount: editable.length, skippedPast, skippedCustomized };
}

export async function moveEntry(
  userId: string,
  entryId: string,
  input: { date: string; startTime: string; endDate?: string; endTime?: string; reason?: string | null }
) {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "ENTRY_NOT_FOUND");

  const newDate = parseDateKey(input.date);
  let newEndDate: Date;
  let newEndTime: string;
  if (input.endDate && input.endTime) {
    newEndDate = parseDateKey(input.endDate);
    newEndTime = input.endTime;
  } else {
    // Default (and drag-and-drop) behavior: preserve the original duration exactly.
    const originalDuration = entryDurationMinutes(entry.date, entry.startTime, entry.endDate, entry.endTime);
    const newStartCombined = combinedMinutes(newDate, input.startTime);
    const resolved = fromCombinedMinutes(newStartCombined + originalDuration);
    newEndDate = resolved.date;
    newEndTime = resolved.time;
  }
  assertValidEntryRange(newDate, input.startTime, newEndDate, newEndTime);

  const overlaps = (await findOverlappingEntries(userId, newDate, input.startTime, newEndDate, newEndTime, entryId)).map(toOverlapInfo);

  const updated = await prisma.dayPlanEntry.update({
    where: { id: entryId },
    data: {
      date: newDate,
      endDate: newEndDate,
      startTime: input.startTime,
      endTime: newEndTime,
      status: "MOVED",
      moveReason: input.reason ?? null,
      // Moving one occurrence off its regular series slot (a different day and/or time
      // than the rest of the block) is a per-day exception, same as a THIS-scope edit.
      isCustomized: entry.seriesId ? true : undefined,
    },
  });
  return { entry: updated, overlaps };
}

export async function setEntryStatus(userId: string, entryId: string, status: "PLANNED" | "IN_PROGRESS" | "SKIPPED") {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "ENTRY_NOT_FOUND");
  return prisma.dayPlanEntry.update({ where: { id: entryId }, data: { status, completedAt: null } });
}


// ---------- Completion (with Routine / GroupRoutine linking + XP dedup) ----------

export type ToggleEntryResult = {
  entry: DayPlanEntry;
  xpDelta: number;
  linkedAction: "routine" | "groupRoutine" | null;
  leveledUp: boolean;
  level: number | null;
  rankedUp: boolean;
};

export async function toggleEntryComplete(userId: string, entryId: string): Promise<ToggleEntryResult> {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "ENTRY_NOT_FOUND");
  // A block "belongs" to its start day for future/past purposes -- an entry starting today
  // 22:00 and ending tomorrow 02:00 must be completable today, even though its end day
  // alone would otherwise look like "the future".
  if (isFutureDay(entry.date)) {
    throw new DayPlanError("Einträge an zukünftigen Tagen können noch nicht abgehakt werden.", "FUTURE_DAY");
  }

  const completing = entry.status !== "DONE";

  if (!completing) {
    if (!entry.linkedRoutineId && !entry.linkedGroupRoutineId) {
      const key = { userId_reason_refDate_refId: { userId, reason: "DAYPLAN_ENTRY_COMPLETE", refDate: entry.date, refId: entry.id } };
      const existingXp = await prisma.xpTransaction.findUnique({ where: key });
      if (existingXp) {
        await prisma.$transaction(async (tx) => {
          await tx.xpTransaction.delete({ where: { id: existingXp.id } });
          await recomputeTotalXp(tx, userId);
        });
      }
    }
    const updated = await prisma.dayPlanEntry.update({ where: { id: entryId }, data: { status: "PLANNED", completedAt: null } });
    return { entry: updated, xpDelta: 0, linkedAction: null, leveledUp: false, level: null, rankedUp: false };
  }

  let xpDelta = 0;
  let linkedAction: "routine" | "groupRoutine" | null = null;
  let leveledUp = false;
  let level: number | null = null;
  let rankedUp = false;

  if (entry.linkedRoutineId) {
    const existing = await prisma.completion.findUnique({
      where: { routineId_date: { routineId: entry.linkedRoutineId, date: entry.date } },
    });
    if (!existing) {
      try {
        const result = await toggleCompletion(userId, entry.linkedRoutineId, entry.date);
        if (result.action === "completed") {
          xpDelta = result.xpDelta;
          linkedAction = "routine";
          leveledUp = result.leveledUp;
          level = result.level;
          rankedUp = result.rankedUp;
        }
      } catch (err) {
        if (!(err instanceof CompletionError)) throw err;
      }
    }
  } else if (entry.linkedGroupRoutineId) {
    const existing = await prisma.groupRoutineCompletion.findUnique({
      where: { groupRoutineId_userId_date: { groupRoutineId: entry.linkedGroupRoutineId, userId, date: entry.date } },
    });
    if (!existing) {
      try {
        const result = await toggleGroupRoutineCompletion(userId, entry.linkedGroupRoutineId, entry.date);
        if (result.action === "completed") {
          xpDelta = result.xpDelta;
          linkedAction = "groupRoutine";
          leveledUp = result.leveledUp;
          level = result.level;
          rankedUp = result.rankedUp;
        }
      } catch (err) {
        if (!(err instanceof GroupRoutineCompletionError)) throw err;
      }
    }
  } else {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.xpForDayPlanning) {
      const key = { userId_reason_refDate_refId: { userId, reason: "DAYPLAN_ENTRY_COMPLETE", refDate: entry.date, refId: entry.id } };
      const already = await prisma.xpTransaction.findUnique({ where: key });
      if (!already) {
        await prisma.$transaction(async (tx) => {
          await tx.xpTransaction.create({
            data: { userId, amount: DAYPLAN_ENTRY_XP, reason: "DAYPLAN_ENTRY_COMPLETE", refDate: entry.date, refId: entry.id },
          });
          await recomputeTotalXp(tx, userId);
        });
        xpDelta = DAYPLAN_ENTRY_XP;
      }
    }
  }

  const updated = await prisma.dayPlanEntry.update({ where: { id: entryId }, data: { status: "DONE", completedAt: new Date() } });
  return { entry: updated, xpDelta, linkedAction, leveledUp, level, rankedUp };
}

// ---------- Templates ----------
// Template entries have no absolute date, so "crosses midnight" is inferred the only way
// possible: endTime <= startTime means "ends the next day" (a template can't represent a
// same-day zero/negative-duration block anyway, so this reading is unambiguous).

function templateEntryEndsNextDay(startTime: string, endTime: string): boolean {
  return endTime <= startTime;
}
function assertValidTemplateEntryTime(startTime: string, endTime: string) {
  if (startTime === endTime) {
    throw new DayPlanError("Start- und Endzeit dürfen nicht identisch sein.", "SAME_START_AND_END");
  }
}

export async function listTemplates(userId: string) {
  return prisma.dayPlanTemplate.findMany({
    where: { userId },
    include: { entries: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createTemplate(
  userId: string,
  input: {
    name: string;
    description?: string | null;
    color: string;
    icon: string;
    entries: Array<Omit<EntryTemplateInput, "linkedRoutineId" | "linkedGroupRoutineId" | "endsNextDay">>;
  }
) {
  for (const e of input.entries) assertValidTemplateEntryTime(e.startTime, e.endTime);
  return prisma.dayPlanTemplate.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      color: input.color,
      icon: input.icon,
      entries: {
        create: input.entries.map((e, i) => ({
          title: e.title,
          description: e.description ?? null,
          startTime: e.startTime,
          endTime: e.endTime,
          category: e.category,
          priority: e.priority,
          color: e.color,
          icon: e.icon,
          location: e.location ?? null,
          link: e.link ?? null,
          notes: e.notes ?? null,
          reminderMinutes: e.reminderMinutes ?? null,
          sortOrder: i,
        })),
      },
    },
    include: { entries: true },
  });
}

export async function updateTemplate(
  userId: string,
  templateId: string,
  input: {
    name?: string;
    description?: string | null;
    color?: string;
    icon?: string;
    entries?: Array<Omit<EntryTemplateInput, "linkedRoutineId" | "linkedGroupRoutineId" | "endsNextDay">>;
  }
) {
  const template = await prisma.dayPlanTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.userId !== userId) throw new DayPlanError("Vorlage nicht gefunden.", "NOT_FOUND");

  if (input.entries) {
    for (const e of input.entries) assertValidTemplateEntryTime(e.startTime, e.endTime);
  }

  return prisma.$transaction(async (tx) => {
    await tx.dayPlanTemplate.update({
      where: { id: templateId },
      data: { name: input.name, description: input.description, color: input.color, icon: input.icon },
    });
    if (input.entries) {
      await tx.dayPlanTemplateEntry.deleteMany({ where: { templateId } });
      await tx.dayPlanTemplateEntry.createMany({
        data: input.entries.map((e, i) => ({
          templateId,
          title: e.title,
          description: e.description ?? null,
          startTime: e.startTime,
          endTime: e.endTime,
          category: e.category,
          priority: e.priority,
          color: e.color,
          icon: e.icon,
          location: e.location ?? null,
          link: e.link ?? null,
          notes: e.notes ?? null,
          reminderMinutes: e.reminderMinutes ?? null,
          sortOrder: i,
        })),
      });
    }
    return tx.dayPlanTemplate.findUniqueOrThrow({ where: { id: templateId }, include: { entries: { orderBy: { sortOrder: "asc" } } } });
  });
}

export async function deleteTemplate(userId: string, templateId: string) {
  const template = await prisma.dayPlanTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.userId !== userId) throw new DayPlanError("Vorlage nicht gefunden.", "NOT_FOUND");
  await prisma.dayPlanTemplate.delete({ where: { id: templateId } });
}

export async function duplicateTemplate(userId: string, templateId: string) {
  const template = await prisma.dayPlanTemplate.findUnique({ where: { id: templateId }, include: { entries: true } });
  if (!template || template.userId !== userId) throw new DayPlanError("Vorlage nicht gefunden.", "NOT_FOUND");
  return prisma.dayPlanTemplate.create({
    data: {
      userId,
      name: `${template.name} (Kopie)`,
      description: template.description,
      color: template.color,
      icon: template.icon,
      entries: {
        create: template.entries.map((e) => ({
          title: e.title,
          description: e.description,
          startTime: e.startTime,
          endTime: e.endTime,
          category: e.category,
          priority: e.priority,
          color: e.color,
          icon: e.icon,
          location: e.location,
          link: e.link,
          notes: e.notes,
          reminderMinutes: e.reminderMinutes,
          sortOrder: e.sortOrder,
        })),
      },
    },
    include: { entries: true },
  });
}

export async function applyTemplate(
  userId: string,
  templateId: string,
  input: { startDate: string; endDate?: string; recurrenceType: DayPlanRecurrenceType; recurrenceDays?: number[] }
) {
  const template = await prisma.dayPlanTemplate.findUnique({
    where: { id: templateId },
    include: { entries: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template || template.userId !== userId) throw new DayPlanError("Vorlage nicht gefunden.", "NOT_FOUND");

  const startDate = parseDateKey(input.startDate);
  const endDate = input.endDate ? parseDateKey(input.endDate) : startDate;
  assertValidRange(startDate, endDate);
  const dates = generateDayPlanDates(startDate, endDate, input.recurrenceType, input.recurrenceDays ?? []);

  if (dates.length * Math.max(1, template.entries.length) > 1000) {
    throw new DayPlanError("Zu viele Einträge auf einmal. Bitte Zeitraum reduzieren.", "RANGE_TOO_LARGE");
  }
  if (dates.length === 0 || template.entries.length === 0) {
    return { count: 0, overlaps: [] as OverlapInfo[] };
  }

  const existing = await prisma.dayPlanEntry.findMany({
    where: { userId, date: { lte: addDaysUtc(dates[dates.length - 1], 1) }, endDate: { gte: dates[0] } },
  });

  const seriesId = randomUUID();
  const overlaps: OverlapInfo[] = [];
  const rows: Prisma.DayPlanEntryCreateManyInput[] = [];
  for (const date of dates) {
    for (const te of template.entries) {
      const entryEndDate = templateEntryEndsNextDay(te.startTime, te.endTime) ? addDaysUtc(date, 1) : date;
      const conflicts = existing.filter((ex) => entriesOverlap(date, te.startTime, entryEndDate, te.endTime, ex.date, ex.startTime, ex.endDate, ex.endTime));
      for (const c of conflicts) overlaps.push(toOverlapInfo(c));
      rows.push({
        userId,
        seriesId,
        date,
        endDate: entryEndDate,
        title: te.title,
        description: te.description,
        startTime: te.startTime,
        endTime: te.endTime,
        category: te.category,
        priority: te.priority,
        color: te.color,
        icon: te.icon,
        location: te.location,
        link: te.link,
        notes: te.notes,
        reminderMinutes: te.reminderMinutes,
      });
    }
  }
  await prisma.dayPlanEntry.createMany({ data: rows });
  return { count: rows.length, overlaps };
}

// ---------- Day review ----------

export async function getDayReview(userId: string, date: Date) {
  return prisma.dayReview.findUnique({ where: { userId_date: { userId, date } } });
}

export async function upsertDayReview(userId: string, date: Date, input: { mood?: string | null; note?: string | null }) {
  return prisma.dayReview.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, mood: (input.mood as never) ?? null, note: input.note ?? null },
    update: { mood: (input.mood as never) ?? null, note: input.note ?? null },
  });
}
