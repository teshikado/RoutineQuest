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

/** Full DayPlan metadata edit, including its date range/recurrence/timezone. Editing the
 * range or recurrence only changes what happens for entries added to the plan *from now
 * on* -- it deliberately never retroactively regenerates or deletes already-materialized
 * entries, since those may carry edits, completions, or XP history that must not be
 * silently destroyed by a container-level change. */
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
  }>
) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");

  const data: Prisma.DayPlanUpdateInput = {
    title: patch.title,
    description: patch.description,
    timeZone: patch.timeZone,
    color: patch.color,
    icon: patch.icon,
    recurrenceType: patch.recurrenceType,
    recurrenceDays: patch.recurrenceDays,
    reminderMinutes: patch.reminderMinutes,
    archived: patch.archived,
  };
  if (patch.startDate || patch.endDate) {
    const newStart = patch.startDate ? parseDateKey(patch.startDate) : plan.startDate;
    const newEnd = patch.endDate ? parseDateKey(patch.endDate) : plan.endDate;
    assertValidRange(newStart, newEnd);
    data.startDate = newStart;
    data.endDate = newEnd;
  }

  return prisma.dayPlan.update({ where: { id: dayPlanId }, data });
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

export async function updateEntry(userId: string, entryId: string, patch: EntryPatch, scope: Scope = "THIS") {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "ENTRY_NOT_FOUND");
  if (patch.linkedRoutineId !== undefined || patch.linkedGroupRoutineId !== undefined) {
    await assertOwnedLinks(userId, patch.linkedRoutineId, patch.linkedGroupRoutineId);
  }

  const targets = await resolveScopeTargets(userId, entry, scope);
  const today = todayDateOnly();
  // Never silently rewrite history: past days are always excluded from bulk scope edits.
  const editable = targets.filter((e) => e.date >= today || e.id === entry.id);
  const skippedPast = targets.length - editable.length;

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
    };
    updated.push(await prisma.dayPlanEntry.update({ where: { id: e.id }, data }));
  }

  return { updated, skippedPast };
}

export async function deleteEntry(userId: string, entryId: string, scope: Scope = "THIS") {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "ENTRY_NOT_FOUND");

  const targets = await resolveScopeTargets(userId, entry, scope);
  const today = todayDateOnly();
  const editable = targets.filter((e) => e.date >= today || e.id === entry.id);
  const skippedPast = targets.length - editable.length;

  await prisma.dayPlanEntry.deleteMany({ where: { id: { in: editable.map((e) => e.id) } } });
  return { deletedCount: editable.length, skippedPast };
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
    },
  });
  return { entry: updated, overlaps };
}

export async function setEntryStatus(userId: string, entryId: string, status: "PLANNED" | "IN_PROGRESS" | "SKIPPED") {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "ENTRY_NOT_FOUND");
  return prisma.dayPlanEntry.update({ where: { id: entryId }, data: { status, completedAt: null } });
}

export async function reorderEntries(userId: string, dayPlanId: string, orderedEntryIds: string[]) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "PLAN_NOT_FOUND");
  const owned = await prisma.dayPlanEntry.findMany({ where: { id: { in: orderedEntryIds }, dayPlanId, userId } });
  if (owned.length !== orderedEntryIds.length) throw new DayPlanError("Eintrag nicht gefunden.", "ENTRY_NOT_FOUND");
  await Promise.all(orderedEntryIds.map((id, i) => prisma.dayPlanEntry.update({ where: { id }, data: { sortOrder: i } })));
}

// ---------- Completion (with Routine / GroupRoutine linking + XP dedup) ----------

export type ToggleEntryResult = {
  entry: DayPlanEntry;
  xpDelta: number;
  linkedAction: "routine" | "groupRoutine" | null;
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
    return { entry: updated, xpDelta: 0, linkedAction: null };
  }

  let xpDelta = 0;
  let linkedAction: "routine" | "groupRoutine" | null = null;

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
  return { entry: updated, xpDelta, linkedAction };
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
