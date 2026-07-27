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
  | "INVALID_DATE"
  | "INVALID_TIME_RANGE"
  | "FUTURE_DAY"
  | "RANGE_TOO_LARGE";

export class DayPlanError extends Error {
  code: DayPlanErrorCode;
  constructor(message: string, code: DayPlanErrorCode) {
    super(message);
    this.code = code;
  }
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function durationMinutes(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
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
    throw new DayPlanError("Das Enddatum darf nicht vor dem Startdatum liegen.", "INVALID_DATE");
  }
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  if (days > MAX_DAYPLAN_RANGE_DAYS) {
    throw new DayPlanError(`Der Zeitraum darf höchstens ${MAX_DAYPLAN_RANGE_DAYS} Tage umfassen.`, "RANGE_TOO_LARGE");
  }
}

export type OverlapInfo = { date: string; title: string; startTime: string; endTime: string };

async function findOverlappingEntries(
  userId: string,
  date: Date,
  startTime: string,
  endTime: string,
  excludeEntryId?: string
): Promise<DayPlanEntry[]> {
  const dayEntries = await prisma.dayPlanEntry.findMany({
    where: { userId, date, id: excludeEntryId ? { not: excludeEntryId } : undefined },
  });
  return dayEntries.filter((e) => intervalsOverlap(e.startTime, e.endTime, startTime, endTime));
}

type EntryTemplateInput = {
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
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

function assertValidEntryTime(startTime: string, endTime: string) {
  if (endTime <= startTime) {
    throw new DayPlanError("Die Endzeit muss nach der Startzeit liegen.", "INVALID_TIME_RANGE");
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
    assertValidEntryTime(e.startTime, e.endTime);
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
      where: { userId, date: { gte: dates[0], lte: dates[dates.length - 1] } },
    });

    for (const e of input.entries) {
      const seriesId = randomUUID();
      const rows: Prisma.DayPlanEntryCreateManyInput[] = dates.map((date) => {
        const conflicts = existing.filter(
          (ex) => dateKey(ex.date) === dateKey(date) && intervalsOverlap(ex.startTime, ex.endTime, e.startTime, e.endTime)
        );
        for (const c of conflicts) {
          overlaps.push({ date: dateKey(date), title: e.title, startTime: c.startTime, endTime: c.endTime });
        }
        return {
          userId,
          dayPlanId: dayPlan.id,
          seriesId,
          date,
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
    include: { entries: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
  });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "NOT_FOUND");
  return plan;
}

export async function updateDayPlanMeta(
  userId: string,
  dayPlanId: string,
  patch: Partial<{ title: string; description: string | null; color: string; icon: string; reminderMinutes: number | null; archived: boolean }>
) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "NOT_FOUND");
  return prisma.dayPlan.update({ where: { id: dayPlanId }, data: patch });
}

export async function deleteDayPlan(userId: string, dayPlanId: string) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "NOT_FOUND");
  await prisma.dayPlan.delete({ where: { id: dayPlanId } });
}

export async function addEntryToPlan(userId: string, dayPlanId: string, e: EntryTemplateInput) {
  const plan = await prisma.dayPlan.findUnique({ where: { id: dayPlanId } });
  if (!plan || plan.userId !== userId) throw new DayPlanError("Tagesplan nicht gefunden.", "NOT_FOUND");
  assertValidEntryTime(e.startTime, e.endTime);
  await assertOwnedLinks(userId, e.linkedRoutineId, e.linkedGroupRoutineId);

  const dates = generateDayPlanDates(plan.startDate, plan.endDate, plan.recurrenceType, plan.recurrenceDays);
  const existing = dates.length
    ? await prisma.dayPlanEntry.findMany({ where: { userId, date: { gte: dates[0], lte: dates[dates.length - 1] } } })
    : [];
  const overlaps: OverlapInfo[] = [];
  const seriesId = randomUUID();
  const rows: Prisma.DayPlanEntryCreateManyInput[] = dates.map((date) => {
    const conflicts = existing.filter(
      (ex) => dateKey(ex.date) === dateKey(date) && intervalsOverlap(ex.startTime, ex.endTime, e.startTime, e.endTime)
    );
    for (const c of conflicts) overlaps.push({ date: dateKey(date), title: e.title, startTime: c.startTime, endTime: c.endTime });
    return {
      userId,
      dayPlanId: plan.id,
      seriesId,
      date,
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

export async function createStandaloneEntry(userId: string, input: EntryTemplateInput & { date: string }) {
  assertValidEntryTime(input.startTime, input.endTime);
  await assertOwnedLinks(userId, input.linkedRoutineId, input.linkedGroupRoutineId);
  const date = parseDateKey(input.date);
  const overlaps = (await findOverlappingEntries(userId, date, input.startTime, input.endTime)).map((c) => ({
    date: dateKey(c.date),
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime,
  }));
  const entry = await prisma.dayPlanEntry.create({
    data: {
      userId,
      date,
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

export async function getEntriesForRange(userId: string, startDate: Date, endDate: Date) {
  return prisma.dayPlanEntry.findMany({
    where: { userId, date: { gte: startDate, lte: endDate } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function getDayBoard(userId: string, day: Date) {
  const entries = await prisma.dayPlanEntry.findMany({ where: { userId, date: day }, orderBy: { startTime: "asc" } });
  const total = entries.length;
  const done = entries.filter((e) => e.status === "DONE").length;
  const skipped = entries.filter((e) => e.status === "SKIPPED").length;
  const open = total - done - skipped;
  const plannedMinutes = entries.reduce((sum, e) => sum + durationMinutes(e.startTime, e.endTime), 0);
  const doneMinutes = entries.filter((e) => e.status === "DONE").reduce((sum, e) => sum + durationMinutes(e.startTime, e.endTime), 0);
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
  startTime: string;
  endTime: string;
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

export async function updateEntry(userId: string, entryId: string, patch: EntryPatch, scope: Scope = "THIS") {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "NOT_FOUND");

  const effectiveStart = patch.startTime ?? entry.startTime;
  const effectiveEnd = patch.endTime ?? entry.endTime;
  assertValidEntryTime(effectiveStart, effectiveEnd);
  if (patch.linkedRoutineId !== undefined || patch.linkedGroupRoutineId !== undefined) {
    await assertOwnedLinks(userId, patch.linkedRoutineId, patch.linkedGroupRoutineId);
  }

  const targets = await resolveScopeTargets(userId, entry, scope);
  const today = todayDateOnly();
  // Never silently rewrite history: past days are always excluded from bulk scope edits.
  const editable = targets.filter((e) => e.date >= today || e.id === entry.id);
  const skippedPast = targets.length - editable.length;

  await prisma.dayPlanEntry.updateMany({ where: { id: { in: editable.map((e) => e.id) } }, data: patch });
  const updated = await prisma.dayPlanEntry.findMany({ where: { id: { in: editable.map((e) => e.id) } } });
  return { updated, skippedPast };
}

export async function deleteEntry(userId: string, entryId: string, scope: Scope = "THIS") {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "NOT_FOUND");

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
  input: { date: string; startTime: string; endTime: string; reason?: string | null }
) {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "NOT_FOUND");
  assertValidEntryTime(input.startTime, input.endTime);

  const newDate = parseDateKey(input.date);
  const overlaps = (await findOverlappingEntries(userId, newDate, input.startTime, input.endTime, entryId)).map((c) => ({
    date: dateKey(c.date),
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime,
  }));

  const updated = await prisma.dayPlanEntry.update({
    where: { id: entryId },
    data: {
      date: newDate,
      startTime: input.startTime,
      endTime: input.endTime,
      status: "MOVED",
      moveReason: input.reason ?? null,
    },
  });
  return { entry: updated, overlaps };
}

export async function setEntryStatus(userId: string, entryId: string, status: "PLANNED" | "IN_PROGRESS" | "SKIPPED") {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "NOT_FOUND");
  return prisma.dayPlanEntry.update({ where: { id: entryId }, data: { status, completedAt: null } });
}

// ---------- Completion (with Routine / GroupRoutine linking + XP dedup) ----------

export type ToggleEntryResult = {
  entry: DayPlanEntry;
  xpDelta: number;
  linkedAction: "routine" | "groupRoutine" | null;
};

export async function toggleEntryComplete(userId: string, entryId: string): Promise<ToggleEntryResult> {
  const entry = await prisma.dayPlanEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) throw new DayPlanError("Eintrag nicht gefunden.", "NOT_FOUND");
  if (isFutureDay(entry.date)) {
    throw new DayPlanError("Einträge an zukünftigen Tagen können noch nicht abgehakt werden.", "FUTURE_DAY");
  }

  const completing = entry.status !== "DONE";

  if (!completing) {
    // Only unlinked entries ever create their own DAYPLAN_ENTRY_COMPLETE XpTransaction (linked
    // entries source their XP from the Routine/GroupRoutine's own completion instead, which is
    // deliberately left untouched here -- see the linked-entry branch below). Remove it on undo
    // so a later re-completion is treated as fresh, not silently deduped against stale XP.
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
        // Linked routine declined the completion (e.g. not scheduled for this weekday) --
        // the plan entry can still be marked done independently.
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
    entries: Array<Omit<EntryTemplateInput, "linkedRoutineId" | "linkedGroupRoutineId">>;
  }
) {
  for (const e of input.entries) assertValidEntryTime(e.startTime, e.endTime);
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
    entries?: Array<Omit<EntryTemplateInput, "linkedRoutineId" | "linkedGroupRoutineId">>;
  }
) {
  const template = await prisma.dayPlanTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.userId !== userId) throw new DayPlanError("Vorlage nicht gefunden.", "NOT_FOUND");

  if (input.entries) {
    for (const e of input.entries) assertValidEntryTime(e.startTime, e.endTime);
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
    where: { userId, date: { gte: dates[0], lte: dates[dates.length - 1] } },
  });

  const seriesId = randomUUID();
  const overlaps: OverlapInfo[] = [];
  const rows: Prisma.DayPlanEntryCreateManyInput[] = [];
  for (const date of dates) {
    for (const te of template.entries) {
      const conflicts = existing.filter(
        (ex) => dateKey(ex.date) === dateKey(date) && intervalsOverlap(ex.startTime, ex.endTime, te.startTime, te.endTime)
      );
      for (const c of conflicts) overlaps.push({ date: dateKey(date), title: te.title, startTime: c.startTime, endTime: c.endTime });
      rows.push({
        userId,
        seriesId,
        date,
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
