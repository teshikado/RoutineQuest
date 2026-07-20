import { prisma } from "./prisma";
import { addDaysUtc, dateKey, existedOn, getWeekInfo, isFutureDay, isoWeekday, zonedStartOfDayUtc, type WeekInfo } from "./dates";
import { getGroupRoutineWeekRows } from "./group-routine-data";

export type DayStatus = "done" | "open" | "missed" | "not_scheduled";

export type WeekRoutineRow = {
  id: string;
  title: string;
  icon: string;
  color: string;
  category: string;
  difficulty: string;
  days: DayStatus[];
  successRate: number | null;
  xpCollected: number;
  groupBadge?: { name: string; icon: string; color: string };
};

export async function getWeekData(userId: string, weekOffset: number) {
  const week = getWeekInfo(new Date(), weekOffset);

  const routines = await prisma.routine.findMany({
    where: { userId, createdAt: { lt: addDaysUtc(week.end, 1) } },
    orderBy: { createdAt: "asc" },
  });

  const completions = await prisma.completion.findMany({
    where: { userId, date: { gte: week.start, lte: week.end } },
  });

  const rows: WeekRoutineRow[] = routines
    .map((routine) => {
      const days: DayStatus[] = week.days.map((day) => {
        const weekday = isoWeekday(day);
        const scheduled = routine.scheduledDays.includes(weekday);
        const existedYet = existedOn(routine.createdAt, day);
        const stillActive = !routine.archived || (routine.archivedAt ? routine.archivedAt > zonedStartOfDayUtc(day) : true);

        if (!scheduled || !existedYet || !stillActive) return "not_scheduled";

        const completed = completions.some(
          (c) => c.routineId === routine.id && dateKey(c.date) === dateKey(day)
        );
        if (completed) return "done";
        if (isFutureDay(day)) return "open";
        return "missed";
      });

      const resolvedCount = days.filter((d) => d === "done" || d === "missed").length;
      const doneCount = days.filter((d) => d === "done").length;
      const successRate = resolvedCount > 0 ? doneCount / resolvedCount : null;
      const xpCollected = completions
        .filter((c) => c.routineId === routine.id)
        .reduce((sum, c) => sum + c.xpAwarded, 0);

      return {
        id: routine.id,
        title: routine.title,
        icon: routine.icon,
        color: routine.color,
        category: routine.category,
        difficulty: routine.difficulty,
        days,
        successRate,
        xpCollected,
      };
    })
    .filter((row) => row.days.some((d) => d !== "not_scheduled"));

  const groupRows = await getGroupRoutineWeekRows(userId, week);

  return { week, rows: [...rows, ...groupRows] };
}

export function weekLabel(week: WeekInfo): string {
  const fmt = (d: Date) => `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  return `${fmt(week.start)} – ${fmt(week.end)}${week.end.getUTCFullYear()}`;
}
