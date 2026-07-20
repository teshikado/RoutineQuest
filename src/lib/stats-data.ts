import { prisma } from "./prisma";
import { addDaysUtc, dateKey, existedOn, getWeekInfo, isFutureDay, isoWeekday, todayDateOnly, zonedStartOfDayUtc } from "./dates";
import { WEEKDAY_LABELS_LONG } from "./constants";

const HISTORY_WINDOW_DAYS = 90;
const HEATMAP_WEEKS = 12;

export async function getStatsData(userId: string) {
  const today = todayDateOnly();
  const historyStart = addDaysUtc(today, -(HISTORY_WINDOW_DAYS - 1));

  const [user, routines, completions, xpTx] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.routine.findMany({ where: { userId, createdAt: { lt: addDaysUtc(today, 1) } } }),
    prisma.completion.findMany({ where: { userId, date: { gte: historyStart, lte: today } } }),
    prisma.xpTransaction.findMany({ where: { userId, refDate: { gte: historyStart, lte: today } } }),
  ]);

  function scheduledRoutinesOn(day: Date) {
    const weekday = isoWeekday(day);
    return routines.filter(
      (r) =>
        r.scheduledDays.includes(weekday) &&
        existedOn(r.createdAt, day) &&
        (!r.archived || (r.archivedAt ? r.archivedAt > zonedStartOfDayUtc(day) : true))
    );
  }

  // --- Daily completions, last 14 days ---
  const dailyCompletions = Array.from({ length: 14 }, (_, i) => {
    const day = addDaysUtc(today, -(13 - i));
    const key = dateKey(day);
    const count = completions.filter((c) => dateKey(c.date) === key).length;
    return { date: key, label: `${day.getUTCDate()}.${day.getUTCMonth() + 1}.`, count };
  });

  // --- Weekly XP, last 8 weeks ---
  const weeklyXp = Array.from({ length: 8 }, (_, i) => {
    const offset = -(7 - i);
    const week = getWeekInfo(today, offset);
    const xp = xpTx
      .filter((t) => t.refDate >= week.start && t.refDate <= week.end)
      .reduce((sum, t) => sum + t.amount, 0);
    return { weekKey: week.weekKey, label: `${week.start.getUTCDate()}.${week.start.getUTCMonth() + 1}.`, xp };
  });
  const thisWeekXp = weeklyXp[weeklyXp.length - 1].xp;
  const lastWeekXp = weeklyXp[weeklyXp.length - 2]?.xp ?? 0;
  const xpChangePct = lastWeekXp > 0 ? Math.round(((thisWeekXp - lastWeekXp) / lastWeekXp) * 100) : null;

  // --- Current week success ratio (ring) ---
  const currentWeek = getWeekInfo(today, 0);
  let weekScheduled = 0;
  let weekDone = 0;
  for (const day of currentWeek.days) {
    if (isFutureDay(day)) continue;
    const scheduled = scheduledRoutinesOn(day);
    weekScheduled += scheduled.length;
    weekDone += scheduled.filter((r) => completions.some((c) => c.routineId === r.id && dateKey(c.date) === dateKey(day))).length;
  }
  const weekSuccessRatio = weekScheduled > 0 ? weekDone / weekScheduled : 0;

  // --- Current month success ratio (ring) ---
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  let monthScheduled = 0;
  let monthDone = 0;
  for (let d = monthStart; d <= today; d = addDaysUtc(d, 1)) {
    const scheduled = scheduledRoutinesOn(d);
    monthScheduled += scheduled.length;
    monthDone += scheduled.filter((r) => completions.some((c) => c.routineId === r.id && dateKey(c.date) === dateKey(d))).length;
  }
  const monthSuccessRatio = monthScheduled > 0 ? monthDone / monthScheduled : 0;

  // --- Most successful weekday (historical, last 90 days) ---
  const weekdayStats = Array.from({ length: 7 }, () => ({ scheduled: 0, done: 0 }));
  for (let d = historyStart; d <= today; d = addDaysUtc(d, 1)) {
    const weekday = isoWeekday(d); // 1..7
    const scheduled = scheduledRoutinesOn(d);
    weekdayStats[weekday - 1].scheduled += scheduled.length;
    weekdayStats[weekday - 1].done += scheduled.filter((r) =>
      completions.some((c) => c.routineId === r.id && dateKey(c.date) === dateKey(d))
    ).length;
  }
  const weekdaySuccess = weekdayStats.map((s, i) => ({
    weekday: i + 1,
    label: WEEKDAY_LABELS_LONG[i + 1],
    ratio: s.scheduled > 0 ? s.done / s.scheduled : null,
  }));
  const bestWeekday = weekdaySuccess
    .filter((w) => w.ratio !== null)
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0] ?? null;

  // --- Frequently skipped routines ---
  const routineMissStats = routines.map((r) => {
    let scheduled = 0;
    let done = 0;
    for (let d = historyStart; d <= today; d = addDaysUtc(d, 1)) {
      if (isFutureDay(d)) continue;
      const weekday = isoWeekday(d);
      if (!r.scheduledDays.includes(weekday)) continue;
      if (!existedOn(r.createdAt, d)) continue;
      if (r.archived && r.archivedAt && r.archivedAt <= zonedStartOfDayUtc(d)) continue;
      scheduled += 1;
      if (completions.some((c) => c.routineId === r.id && dateKey(c.date) === dateKey(d))) done += 1;
    }
    return {
      id: r.id,
      title: r.title,
      icon: r.icon,
      color: r.color,
      scheduled,
      missed: scheduled - done,
      missRate: scheduled > 0 ? (scheduled - done) / scheduled : 0,
    };
  });
  const frequentlySkipped = routineMissStats
    .filter((r) => r.scheduled >= 3 && r.missed > 0)
    .sort((a, b) => b.missRate - a.missRate)
    .slice(0, 5);

  // --- Heatmap, last 12 weeks ---
  const heatmapStart = addDaysUtc(getWeekInfo(today, -(HEATMAP_WEEKS - 1)).start, 0);
  const heatmap: { date: string; count: number; scheduled: number }[] = [];
  for (let d = heatmapStart; d <= today; d = addDaysUtc(d, 1)) {
    const scheduled = scheduledRoutinesOn(d);
    const done = scheduled.filter((r) => completions.some((c) => c.routineId === r.id && dateKey(c.date) === dateKey(d))).length;
    heatmap.push({ date: dateKey(d), count: done, scheduled: scheduled.length });
  }

  return {
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    dailyCompletions,
    weeklyXp,
    thisWeekXp,
    lastWeekXp,
    xpChangePct,
    weekSuccessRatio,
    monthSuccessRatio,
    weekdaySuccess,
    bestWeekday,
    frequentlySkipped,
    heatmap,
  };
}
