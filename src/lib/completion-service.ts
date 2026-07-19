import type { Prisma, Routine } from "@prisma/client";
import { prisma } from "./prisma";
import { DIFFICULTY_META, STREAK_MIN_RATIO, XP_BONUS } from "./constants";
import { addDaysUtc, dateKey, getWeekInfo, isFutureDay, isoWeekday, todayDateOnly, toDateOnly } from "./dates";
import { getLevelProgress, getRankForLevel } from "./xp";
import { notify } from "./notifications";

type TxClient = Prisma.TransactionClient;

const UNDO_WINDOW_MINUTES = 10;
const STREAK_LOOKBACK_DAYS = 400;

export class CompletionError extends Error {}

async function getScheduledRoutines(tx: TxClient, userId: string, date: Date): Promise<Routine[]> {
  const weekday = isoWeekday(date);
  const endOfDay = new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
  const all = await tx.routine.findMany({
    where: {
      userId,
      scheduledDays: { has: weekday },
      createdAt: { lte: endOfDay },
    },
  });
  return all.filter((r) => !r.archived || (r.archivedAt && r.archivedAt > date));
}

async function getCompletedRoutineIds(tx: TxClient, userId: string, date: Date): Promise<Set<string>> {
  const completions = await tx.completion.findMany({
    where: { userId, date },
    select: { routineId: true },
  });
  return new Set(completions.map((c) => c.routineId));
}

async function reconcileDailyBonus(tx: TxClient, userId: string, date: Date) {
  const scheduled = await getScheduledRoutines(tx, userId, date);
  const completedIds = await getCompletedRoutineIds(tx, userId, date);
  const allDone = scheduled.length > 0 && scheduled.every((r) => completedIds.has(r.id));

  const key = { userId_reason_refDate_refId: { userId, reason: "DAILY_COMPLETE", refDate: date, refId: "daily" } };
  const existing = await tx.xpTransaction.findUnique({ where: key });

  if (allDone && !existing) {
    await tx.xpTransaction.create({
      data: { userId, amount: XP_BONUS.DAILY_COMPLETE, reason: "DAILY_COMPLETE", refDate: date, refId: "daily" },
    });
  } else if (!allDone && existing) {
    await tx.xpTransaction.delete({ where: { id: existing.id } });
  }
}

async function dayDoneRatio(tx: TxClient, userId: string, date: Date): Promise<{ scheduled: number; done: number }> {
  const scheduled = await getScheduledRoutines(tx, userId, date);
  if (scheduled.length === 0) return { scheduled: 0, done: 0 };
  const completedIds = await getCompletedRoutineIds(tx, userId, date);
  const done = scheduled.filter((r) => completedIds.has(r.id)).length;
  return { scheduled: scheduled.length, done };
}

/**
 * Recomputes current + longest streak by walking backward from today. Days with no
 * scheduled tasks are skipped and never break the streak. The walk stops at the account's
 * creation date — there's no meaningful history before that, and without this bound the
 * loop would run the full STREAK_LOOKBACK_DAYS (each iteration a DB round trip) for any
 * account that doesn't have a routine scheduled on every single day since signup, which
 * for newer accounts routinely overran the interactive transaction's timeout.
 */
async function recomputeStreak(tx: TxClient, userId: string): Promise<number> {
  const today = todayDateOnly();
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  const accountCreatedDay = toDateOnly(user.createdAt);
  let current = 0;

  // Today only counts once it already meets the threshold; otherwise it's "pending", not a break.
  const todayStats = await dayDoneRatio(tx, userId, today);
  const todayQualifies = todayStats.scheduled > 0 && todayStats.done / todayStats.scheduled >= STREAK_MIN_RATIO;
  if (todayQualifies) {
    current += 1;
  }

  let cursor = addDaysUtc(today, -1);
  for (let i = 0; i < STREAK_LOOKBACK_DAYS && cursor >= accountCreatedDay; i++) {
    const stats = await dayDoneRatio(tx, userId, cursor);
    if (stats.scheduled === 0) {
      cursor = addDaysUtc(cursor, -1);
      continue;
    }
    const ratio = stats.done / stats.scheduled;
    if (ratio >= STREAK_MIN_RATIO) {
      current += 1;
      cursor = addDaysUtc(cursor, -1);
    } else {
      break;
    }
  }

  const longest = Math.max(user.longestStreak, current);
  await tx.user.update({ where: { id: userId }, data: { currentStreak: current, longestStreak: longest } });
  return current;
}

async function reconcileStreakMilestone(tx: TxClient, userId: string, currentStreak: number) {
  const today = todayDateOnly();
  const key = { userId_reason_refDate_refId: { userId, reason: "STREAK_MILESTONE", refDate: today, refId: "streak" } };
  const existing = await tx.xpTransaction.findUnique({ where: key });
  const qualifies = currentStreak > 0 && currentStreak % 7 === 0;

  if (qualifies && !existing) {
    await tx.xpTransaction.create({
      data: { userId, amount: XP_BONUS.STREAK_MILESTONE, reason: "STREAK_MILESTONE", refDate: today, refId: "streak" },
    });
  } else if (!qualifies && existing) {
    await tx.xpTransaction.delete({ where: { id: existing.id } });
  }
}

async function reconcilePerfectWeek(tx: TxClient, userId: string, date: Date) {
  const week = getWeekInfo(date);
  const today = todayDateOnly();

  const key = { userId_reason_refDate_refId: { userId, reason: "PERFECT_WEEK", refDate: week.start, refId: week.weekKey } };
  const existing = await tx.xpTransaction.findUnique({ where: key });

  // A "perfect week" only makes sense once the account existed for the entire week —
  // otherwise days before signup (which trivially have "0 scheduled / 0 done") would
  // count as satisfied for free, letting a brand-new account earn the full-week bonus
  // off a single day of activity.
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
  if (toDateOnly(user.createdAt) > week.start) {
    if (existing) await tx.xpTransaction.delete({ where: { id: existing.id } });
    return;
  }

  const remainingScheduledAfterToday = await Promise.all(
    week.days.filter((d) => isFutureDay(d)).map((d) => getScheduledRoutines(tx, userId, d))
  );
  const weekUnresolved = remainingScheduledAfterToday.some((r) => r.length > 0);

  if (weekUnresolved) {
    if (existing) await tx.xpTransaction.delete({ where: { id: existing.id } });
    return;
  }

  const daysToConsider = week.days.filter((d) => !isFutureDay(d) || dateKey(d) === dateKey(today));
  let totalScheduled = 0;
  let totalDone = 0;
  for (const d of daysToConsider) {
    const stats = await dayDoneRatio(tx, userId, d);
    totalScheduled += stats.scheduled;
    totalDone += stats.done;
  }
  const perfect = totalScheduled > 0 && totalDone === totalScheduled;

  if (perfect && !existing) {
    await tx.xpTransaction.create({
      data: { userId, amount: XP_BONUS.PERFECT_WEEK, reason: "PERFECT_WEEK", refDate: week.start, refId: week.weekKey },
    });
  } else if (!perfect && existing) {
    await tx.xpTransaction.delete({ where: { id: existing.id } });
  }
}

export async function recomputeTotalXp(tx: TxClient, userId: string): Promise<number> {
  const agg = await tx.xpTransaction.aggregate({ where: { userId }, _sum: { amount: true } });
  const totalXp = agg._sum.amount ?? 0;
  await tx.user.update({ where: { id: userId }, data: { totalXp } });
  return totalXp;
}

export type ToggleResult = {
  action: "completed" | "uncompleted";
  xpDelta: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  rankedUp: boolean;
  canUndo: boolean;
};

export async function toggleCompletion(userId: string, routineId: string, date: Date): Promise<ToggleResult> {
  if (isFutureDay(date)) {
    throw new CompletionError("Zukünftige Aufgaben können noch nicht abgehakt werden.");
  }

  return prisma.$transaction(async (tx) => {
    const routine = await tx.routine.findUnique({ where: { id: routineId } });
    if (!routine || routine.userId !== userId) {
      throw new CompletionError("Routine nicht gefunden.");
    }
    if (!routine.scheduledDays.includes(isoWeekday(date))) {
      throw new CompletionError("Diese Routine ist an diesem Tag nicht geplant.");
    }

    const userBefore = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const levelBefore = getLevelProgress(userBefore.totalXp).level;
    const rankBefore = getRankForLevel(levelBefore);

    const existing = await tx.completion.findUnique({
      where: { routineId_date: { routineId, date } },
    });

    let action: "completed" | "uncompleted";
    let xpDelta = 0;
    let canUndo = true;

    if (!existing) {
      const xp = DIFFICULTY_META[routine.difficulty].xp;
      const completion = await tx.completion.create({
        data: { routineId, userId, date, xpAwarded: xp },
      });
      await tx.xpTransaction.create({
        data: { userId, amount: xp, reason: "TASK_COMPLETE", refDate: date, refId: completion.id },
      });
      action = "completed";
      xpDelta = xp;
    } else {
      const ageMs = Date.now() - existing.createdAt.getTime();
      if (ageMs > UNDO_WINDOW_MINUTES * 60 * 1000) {
        throw new CompletionError(
          `Diese Aufgabe kann nur innerhalb von ${UNDO_WINDOW_MINUTES} Minuten rückgängig gemacht werden.`
        );
      }
      const tx1 = await tx.xpTransaction.findUnique({
        where: { userId_reason_refDate_refId: { userId, reason: "TASK_COMPLETE", refDate: date, refId: existing.id } },
      });
      if (tx1) await tx.xpTransaction.delete({ where: { id: tx1.id } });
      await tx.completion.delete({ where: { id: existing.id } });
      action = "uncompleted";
      xpDelta = -(tx1?.amount ?? existing.xpAwarded);
      canUndo = false;
    }

    await reconcileDailyBonus(tx, userId, date);
    const currentStreak = await recomputeStreak(tx, userId);
    await reconcileStreakMilestone(tx, userId, currentStreak);
    await reconcilePerfectWeek(tx, userId, date);
    const totalXp = await recomputeTotalXp(tx, userId);

    const levelAfter = getLevelProgress(totalXp).level;
    const rankAfter = getRankForLevel(levelAfter);
    const leveledUp = levelAfter > levelBefore;
    const rankedUp = rankAfter.key !== rankBefore.key && levelAfter > levelBefore;

    if (leveledUp) {
      await notify(
        tx,
        userId,
        "LEVEL_UP",
        `Level Up! Du bist jetzt Level ${levelAfter}.`,
        rankedUp ? `Du bist jetzt ${rankAfter.name}.` : `Weiter so!`
      );
    }
    if (rankedUp) {
      await notify(tx, userId, "RANK_UP", `Rangaufstieg: ${rankAfter.name}!`, rankAfter.description);
    }

    return {
      action,
      xpDelta,
      totalXp,
      level: levelAfter,
      leveledUp,
      rankedUp,
      canUndo: action === "completed" && canUndo,
    };
  });
}

export async function getDayBoard(userId: string, date: Date) {
  const scheduled = await getScheduledRoutines(prisma, userId, date);
  const completions = await prisma.completion.findMany({ where: { userId, date } });
  const completedIds = new Set(completions.map((c) => c.routineId));
  return scheduled.map((r) => ({
    routine: r,
    completed: completedIds.has(r.id),
    completion: completions.find((c) => c.routineId === r.id) ?? null,
  }));
}
