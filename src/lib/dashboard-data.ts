import { prisma } from "./prisma";
import { getDayBoard } from "./completion-service";
import { getGroupRoutineDayBoard } from "./group-routine-data";
import { dateKey, existedOn, getWeekInfo, isoWeekday, todayDateOnly } from "./dates";

export async function getDashboardData(userId: string) {
  const today = todayDateOnly();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const board = await getDayBoard(userId, today);
  const groupBoard = await getGroupRoutineDayBoard(userId, today);

  const week = getWeekInfo(today);
  const weekRoutines = await prisma.routine.findMany({
    where: { userId, createdAt: { lte: new Date() } },
  });
  const weekCompletions = await prisma.completion.findMany({
    where: { userId, date: { gte: week.start, lte: week.end } },
  });

  const weekMini = week.days.map((day) => {
    const weekday = isoWeekday(day);
    const scheduled = weekRoutines.filter(
      (r) => r.scheduledDays.includes(weekday) && existedOn(r.createdAt, day) && (!r.archived || (r.archivedAt && r.archivedAt > day))
    );
    const done = weekCompletions.filter(
      (c) => dateKey(c.date) === dateKey(day) && scheduled.some((r) => r.id === c.routineId)
    ).length;
    return { dateKey: dateKey(day), scheduled: scheduled.length, done };
  });

  const groupsSummary = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: { include: { _count: { select: { members: true } } } } },
  });

  return {
    user,
    board,
    groupBoard,
    weekMini,
    groups: groupsSummary.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      icon: m.group.icon,
      color: m.group.color,
      memberCount: m.group._count.members,
    })),
  };
}
