import { prisma } from "./prisma";
import { addDaysUtc, dateKey, getWeekInfo, isFutureDay, todayDateOnly } from "./dates";
import { isGroupRoutinePlannedDay } from "./group-routine-data";
import { computeWeeklyTargetProgress } from "./group-routine-weekly";

const TREND_PERIODS = 8;
const HEATMAP_DAYS = 28;

export type GroupRoutinePeriod = "week" | "month";

export async function getGroupRoutineStats(groupRoutineId: string, period: GroupRoutinePeriod = "week") {
  const routine = await prisma.groupRoutine.findUniqueOrThrow({ where: { id: groupRoutineId } });
  const participants = await prisma.groupRoutineParticipant.findMany({
    where: { groupRoutineId, status: "JOINED" },
    include: { user: { select: { id: true, username: true, avatarEmoji: true, avatarColor: true } } },
  });
  const completions = await prisma.groupRoutineCompletion.findMany({ where: { groupRoutineId } });

  const today = todayDateOnly();

  function rangeFor(offset: number) {
    if (period === "week") {
      const w = getWeekInfo(today, offset);
      return { start: w.start, end: w.end, label: `${w.start.getUTCDate()}.${w.start.getUTCMonth() + 1}.` };
    }
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
    return { start: monthStart, end: monthEnd, label: `${monthStart.getUTCMonth() + 1}/${monthStart.getUTCFullYear()}` };
  }

  function rateForRange(userId: string, start: Date, end: Date) {
    const participant = participants.find((p) => p.userId === userId);
    if (!participant) return { planned: 0, done: 0, rate: null as number | null };

    if (routine.goalType === "WEEKLY") {
      const completedDates = new Set(
        completions.filter((c) => c.userId === userId).map((c) => dateKey(c.date))
      );
      const cappedEnd = isFutureDay(end) ? todayDateOnly() : end;
      if (cappedEnd < start) return { planned: 0, done: 0, rate: null as number | null };
      const { planned, completed: done } = computeWeeklyTargetProgress(routine, participant, completedDates, start, cappedEnd);
      return { planned, done, rate: planned > 0 ? done / planned : null };
    }

    let planned = 0;
    let done = 0;
    for (let d = start; d <= end; d = addDaysUtc(d, 1)) {
      if (isFutureDay(d)) continue;
      if (!isGroupRoutinePlannedDay(routine, participant, d)) continue;
      planned += 1;
      if (completions.some((c) => c.userId === userId && dateKey(c.date) === dateKey(d))) done += 1;
    }
    return { planned, done, rate: planned > 0 ? done / planned : null };
  }

  const current = rangeFor(0);
  const previous = rangeFor(-1);

  const memberRows = participants.map((p) => {
    const cur = rateForRange(p.userId, current.start, current.end);
    const prev = rateForRange(p.userId, previous.start, previous.end);
    return {
      userId: p.userId,
      username: p.user.username,
      avatarEmoji: p.user.avatarEmoji,
      avatarColor: p.user.avatarColor,
      completions: cur.done,
      successRate: cur.rate,
      currentStreak: p.currentStreak,
      improvementPct: cur.rate !== null && prev.rate !== null ? Math.round((cur.rate - prev.rate) * 100) : null,
    };
  });

  const mostCompletions = [...memberRows].sort((a, b) => b.completions - a.completions)[0] ?? null;
  const highestRate =
    [...memberRows].filter((m) => m.successRate !== null).sort((a, b) => (b.successRate ?? 0) - (a.successRate ?? 0))[0] ??
    null;
  const longestStreakParticipant = [...participants].sort((a, b) => b.currentStreak - a.currentStreak)[0] ?? null;

  const totalCompletionsInRange = completions.filter((c) => c.date >= current.start && c.date <= current.end).length;

  const ratesWithValue = memberRows.map((m) => m.successRate).filter((r): r is number => r !== null);
  const avgSuccessRate =
    ratesWithValue.length > 0 ? ratesWithValue.reduce((s, r) => s + r, 0) / ratesWithValue.length : null;

  const prevRatesWithValue = participants
    .map((p) => rateForRange(p.userId, previous.start, previous.end).rate)
    .filter((r): r is number => r !== null);
  const prevAvgSuccessRate =
    prevRatesWithValue.length > 0 ? prevRatesWithValue.reduce((s, r) => s + r, 0) / prevRatesWithValue.length : null;
  const groupImprovementPct =
    avgSuccessRate !== null && prevAvgSuccessRate !== null
      ? Math.round((avgSuccessRate - prevAvgSuccessRate) * 100)
      : null;

  const trend = Array.from({ length: TREND_PERIODS }, (_, i) => {
    const offset = -(TREND_PERIODS - 1 - i);
    const range = rangeFor(offset);
    const rates = participants
      .map((p) => rateForRange(p.userId, range.start, range.end).rate)
      .filter((r): r is number => r !== null);
    const avg = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : null;
    return { label: range.label, successRate: avg };
  });

  const heatmapStart = addDaysUtc(today, -(HEATMAP_DAYS - 1));
  const heatmap: { date: string; count: number; scheduled: number }[] = [];
  for (let d = heatmapStart; d <= today; d = addDaysUtc(d, 1)) {
    const key = dateKey(d);
    const plannedCount = participants.filter((p) => isGroupRoutinePlannedDay(routine, p, d)).length;
    heatmap.push({ date: key, count: completions.filter((c) => dateKey(c.date) === key).length, scheduled: plannedCount });
  }

  return {
    period,
    rangeLabel: current.label,
    participantCount: participants.length,
    totalCompletions: totalCompletionsInRange,
    avgSuccessRate,
    groupImprovementPct,
    mostCompletions,
    highestRate,
    longestStreakMember: longestStreakParticipant
      ? {
          userId: longestStreakParticipant.userId,
          username: longestStreakParticipant.user.username,
          streak: longestStreakParticipant.currentStreak,
        }
      : null,
    members: memberRows,
    trend,
    heatmap,
  };
}

export type GroupRoutineStats = Awaited<ReturnType<typeof getGroupRoutineStats>>;
