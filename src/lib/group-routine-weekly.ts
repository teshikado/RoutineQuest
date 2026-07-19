import type { GroupRoutine, GroupRoutineParticipant } from "@prisma/client";
import { addDaysUtc, dateKey, getWeekInfo, toDateOnly } from "./dates";

/**
 * Scoring for the "Bestimmte Anzahl pro Woche" repetition mode (`goalType === "WEEKLY"`):
 * members may complete the routine on any eligible day, so "planned"/"done" are counted
 * per ISO week (Monday–Sunday) instead of per day, capped at `goalTarget`. A week's target
 * is capped by however many eligible days actually fell in range that week, so a routine
 * that starts or a member who joins mid-week is never held to the full weekly target.
 */

type Routine = Pick<GroupRoutine, "startDate" | "endDate" | "goalTarget">;
type Participant = Pick<GroupRoutineParticipant, "joinedAt">;

function weekStats(
  routine: Routine,
  weekStart: Date,
  from: Date,
  upto: Date,
  completedDates: Set<string>
): { target: number; done: number } {
  const target = routine.goalTarget ?? 0;
  const weekEnd = addDaysUtc(weekStart, 6);
  const rangeStart = weekStart < from ? from : weekStart;
  const rangeEnd = weekEnd > upto ? upto : weekEnd;
  if (rangeStart > rangeEnd) return { target: 0, done: 0 };

  const daysInRange = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1;
  const weekTarget = Math.min(target, daysInRange);
  let done = 0;
  for (let d = rangeStart; d <= rangeEnd; d = addDaysUtc(d, 1)) {
    if (completedDates.has(dateKey(d))) done += 1;
  }
  return { target: weekTarget, done: Math.min(done, weekTarget) };
}

/** Cumulative planned/completed units for a participant from `from` through `upto` (inclusive). */
export function computeWeeklyTargetProgress(
  routine: Routine,
  participant: Participant,
  completedDates: Set<string>,
  from: Date,
  upto: Date
): { planned: number; completed: number } {
  if (!participant.joinedAt || (routine.goalTarget ?? 0) <= 0) return { planned: 0, completed: 0 };

  const start = toDateOnly(routine.startDate);
  const joined = toDateOnly(participant.joinedAt);
  const end = routine.endDate ? toDateOnly(routine.endDate) : null;
  const effectiveFrom = [start, joined, toDateOnly(from)].reduce((a, b) => (a > b ? a : b));
  const effectiveUpto = end && toDateOnly(upto) > end ? end : toDateOnly(upto);
  if (effectiveFrom > effectiveUpto) return { planned: 0, completed: 0 };

  let planned = 0;
  let completed = 0;
  let weekStart = getWeekInfo(effectiveFrom, 0).start;
  while (weekStart <= effectiveUpto) {
    const { target, done } = weekStats(routine, weekStart, effectiveFrom, effectiveUpto, completedDates);
    planned += target;
    completed += done;
    weekStart = addDaysUtc(weekStart, 7);
  }
  return { planned, completed };
}

/** Current/longest streak in consecutive weeks that met the target, mirroring the daily model: the
 * current (possibly still-open) week only ever adds to the streak, never breaks it early. */
export function computeWeeklyTargetStreak(
  routine: Routine,
  participant: Participant & { longestStreak: number },
  completedDates: Set<string>,
  today: Date
): { current: number; longest: number } {
  if (!participant.joinedAt || (routine.goalTarget ?? 0) <= 0) {
    return { current: 0, longest: participant.longestStreak };
  }

  const start = toDateOnly(routine.startDate);
  const joined = toDateOnly(participant.joinedAt);
  const from = start > joined ? start : joined;
  const end = routine.endDate ? toDateOnly(routine.endDate) : null;
  const cutoff = end && end < today ? end : today;
  if (from > cutoff) return { current: 0, longest: participant.longestStreak };

  const met = (weekStart: Date) => {
    const { target, done } = weekStats(routine, weekStart, from, cutoff, completedDates);
    return target > 0 && done >= target;
  };

  const currentWeekStart = getWeekInfo(cutoff, 0).start;
  const firstWeekStart = getWeekInfo(from, 0).start;

  let current = met(currentWeekStart) ? 1 : 0;
  let cursor = addDaysUtc(currentWeekStart, -7);
  while (cursor >= firstWeekStart) {
    if (!met(cursor)) break;
    current += 1;
    cursor = addDaysUtc(cursor, -7);
  }

  return { current, longest: Math.max(participant.longestStreak, current) };
}
