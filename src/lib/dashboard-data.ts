import { prisma } from "./prisma";
import { getDayBoard } from "./completion-service";
import { getGroupRoutineDayBoard } from "./group-routine-data";
import { dateKey, existedOn, getWeekInfo, isoWeekday, todayDateOnly, zonedStartOfDayUtc } from "./dates";

export async function getDashboardData(userId: string) {
  const today = todayDateOnly();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const board = await getDayBoard(userId, today);
  const groupBoard = await getGroupRoutineDayBoard(userId, today);

  // Interval overlap, not `date: today` -- a block that started yesterday and crosses
  // midnight into today (e.g. 22:00-02:00) must still show up as "today's" entry even
  // though its own `date` is yesterday. Ordered by (date, startTime) rather than just
  // startTime so such an overnight entry sorts correctly relative to today's own entries.
  const todayPlanEntries = await prisma.dayPlanEntry.findMany({
    where: { userId, date: { lte: today }, endDate: { gte: today } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const manualOrder = await prisma.dashboardItemOrder.findMany({ where: { userId } });

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
      (r) =>
        r.scheduledDays.includes(weekday) &&
        existedOn(r.createdAt, day) &&
        (!r.archived || (r.archivedAt && r.archivedAt > zonedStartOfDayUtc(day)))
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
    // Lean today-relevant fields only -- the client recomputes "next open entry" /
    // done-open stats itself (see dashboard-client.tsx) so it can react instantly to a
    // dashboard-side toggle without a full page reload.
    todayPlanEntries: todayPlanEntries.map((e) => ({
      id: e.id,
      title: e.title,
      icon: e.icon,
      color: e.color,
      startTime: e.startTime,
      endTime: e.endTime,
      endDateKey: dateKey(e.endDate),
      status: e.status,
      linkedRoutineId: e.linkedRoutineId,
      linkedGroupRoutineId: e.linkedGroupRoutineId,
    })),
    manualOrder: manualOrder.map((m) => ({ itemType: m.itemType, itemId: m.itemId, sortOrder: m.sortOrder })),
    groups: groupsSummary.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      icon: m.group.icon,
      color: m.group.color,
      memberCount: m.group._count.members,
    })),
  };
}

/** Persists the user's manual "Heute" ordering. Only ever called with the open items
 * currently visible to the user, so this always fully replaces their whole manual order --
 * there's no partial-update case to reconcile against. */
export async function saveDashboardOrder(
  userId: string,
  items: { itemType: "PERSONAL_ROUTINE" | "GROUP_ROUTINE"; itemId: string; sortOrder: number }[]
) {
  await prisma.$transaction([
    prisma.dashboardItemOrder.deleteMany({ where: { userId } }),
    prisma.dashboardItemOrder.createMany({
      data: items.map((i) => ({ userId, itemType: i.itemType, itemId: i.itemId, sortOrder: i.sortOrder })),
    }),
  ]);
}

export async function resetDashboardOrder(userId: string) {
  await prisma.dashboardItemOrder.deleteMany({ where: { userId } });
}
