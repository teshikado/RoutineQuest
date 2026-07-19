import { prisma } from "./prisma";
import { addDaysUtc, dateKey, getWeekInfo, isFutureDay, todayDateOnly, toDateOnly } from "./dates";
import { isGroupRoutinePlannedDay } from "./group-routine-data";
import { computeWeeklyTargetProgress } from "./group-routine-weekly";

/**
 * Sort order follows the "faire Bewertung" spec exactly: success rate first (so members
 * who joined late or whose routine wasn't scheduled on a day are never penalized for it),
 * then current streak, completed days, routine XP, and finally earlier join date.
 */
export async function getGroupRoutineLeaderboard(groupRoutineId: string) {
  const routine = await prisma.groupRoutine.findUniqueOrThrow({ where: { id: groupRoutineId } });
  const participants = await prisma.groupRoutineParticipant.findMany({
    where: { groupRoutineId, status: "JOINED" },
    include: { user: { select: { id: true, username: true, avatarEmoji: true, avatarColor: true } } },
  });

  const today = todayDateOnly();
  const thisWeek = getWeekInfo(today, 0);
  const lastWeek = getWeekInfo(today, -1);

  const rows = await Promise.all(
    participants.map(async (p) => {
      const completions = await prisma.groupRoutineCompletion.findMany({
        where: { groupRoutineId, userId: p.userId },
      });
      const completedDates = new Set(completions.map((c) => dateKey(c.date)));
      const isWeeklyTarget = routine.goalType === "WEEKLY";

      let plannedSoFar = 0;
      let completedSoFar = 0;
      const startCursor = toDateOnly(p.joinedAt ?? routine.startDate);
      if (isWeeklyTarget) {
        const progress = computeWeeklyTargetProgress(routine, p, completedDates, startCursor, today);
        plannedSoFar = progress.planned;
        completedSoFar = progress.completed;
      } else {
        for (let d = startCursor; d <= today; d = addDaysUtc(d, 1)) {
          if (!isGroupRoutinePlannedDay(routine, p, d)) continue;
          plannedSoFar += 1;
          if (completedDates.has(dateKey(d))) completedSoFar += 1;
        }
      }

      const rateForWeek = (week: ReturnType<typeof getWeekInfo>) => {
        if (isWeeklyTarget) {
          const progress = computeWeeklyTargetProgress(routine, p, completedDates, week.start, week.end);
          return progress.planned > 0 ? progress.completed / progress.planned : null;
        }
        let planned = 0;
        let done = 0;
        for (const d of week.days) {
          if (isFutureDay(d)) continue;
          if (!isGroupRoutinePlannedDay(routine, p, d)) continue;
          planned += 1;
          if (completedDates.has(dateKey(d))) done += 1;
        }
        return planned > 0 ? done / planned : null;
      };

      const successRate = plannedSoFar > 0 ? completedSoFar / plannedSoFar : null;
      const thisWeekRate = rateForWeek(thisWeek);
      const lastWeekRate = rateForWeek(lastWeek);
      const improvementPct =
        thisWeekRate !== null && lastWeekRate !== null ? Math.round((thisWeekRate - lastWeekRate) * 100) : null;

      const routineXp = completions.reduce((sum, c) => sum + c.xpAwarded, 0);

      return {
        userId: p.userId,
        username: p.user.username,
        avatarEmoji: p.user.avatarEmoji,
        avatarColor: p.user.avatarColor,
        joinedAt: p.joinedAt?.toISOString() ?? null,
        completedDays: completedSoFar,
        plannedDays: plannedSoFar,
        successRate,
        currentStreak: p.currentStreak,
        longestStreak: p.longestStreak,
        routineXp,
        improvementPct,
      };
    })
  );

  rows.sort((a, b) => {
    const rateA = a.successRate ?? -1;
    const rateB = b.successRate ?? -1;
    if (rateB !== rateA) return rateB - rateA;
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    if (b.completedDays !== a.completedDays) return b.completedDays - a.completedDays;
    if (b.routineXp !== a.routineXp) return b.routineXp - a.routineXp;
    const joinedA = a.joinedAt ? new Date(a.joinedAt).getTime() : Infinity;
    const joinedB = b.joinedAt ? new Date(b.joinedAt).getTime() : Infinity;
    return joinedA - joinedB;
  });

  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}

export type GroupRoutineLeaderboardRow = Awaited<ReturnType<typeof getGroupRoutineLeaderboard>>[number];
