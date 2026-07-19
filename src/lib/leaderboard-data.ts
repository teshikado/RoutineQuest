import { prisma } from "./prisma";
import { addDaysUtc, dateKey, existedOn, getWeekInfo, isFutureDay, isoWeekday } from "./dates";
import { getLevelProgress, getRankForLevel } from "./xp";

export async function getGroupLeaderboard(groupId: string, requestingUserId: string) {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });

  const thisWeek = getWeekInfo(new Date(), 0);
  const lastWeek = getWeekInfo(new Date(), -1);

  const rows = await Promise.all(
    members.map(async (m) => {
      const userId = m.userId;

      const [thisWeekXp, lastWeekXp, thisWeekCompletions, routines] = await Promise.all([
        prisma.xpTransaction.aggregate({
          where: { userId, refDate: { gte: thisWeek.start, lte: thisWeek.end } },
          _sum: { amount: true },
        }),
        prisma.xpTransaction.aggregate({
          where: { userId, refDate: { gte: lastWeek.start, lte: lastWeek.end } },
          _sum: { amount: true },
        }),
        prisma.completion.count({
          where: { userId, date: { gte: thisWeek.start, lte: thisWeek.end } },
        }),
        prisma.routine.findMany({ where: { userId, createdAt: { lt: addDaysUtc(thisWeek.end, 1) } } }),
      ]);

      let scheduled = 0;
      let done = 0;
      const completions = await prisma.completion.findMany({
        where: { userId, date: { gte: thisWeek.start, lte: thisWeek.end } },
      });
      for (const day of thisWeek.days) {
        if (isFutureDay(day)) continue;
        const weekday = isoWeekday(day);
        const dayRoutines = routines.filter(
          (r) => r.scheduledDays.includes(weekday) && existedOn(r.createdAt, day) && (!r.archived || (r.archivedAt ? r.archivedAt > day : true))
        );
        scheduled += dayRoutines.length;
        done += dayRoutines.filter((r) =>
          completions.some((c) => c.routineId === r.id && dateKey(c.date) === dateKey(day))
        ).length;
      }

      const xpThis = thisWeekXp._sum.amount ?? 0;
      const xpLast = lastWeekXp._sum.amount ?? 0;
      const improvementPct = xpLast > 0 ? Math.round(((xpThis - xpLast) / xpLast) * 100) : xpThis > 0 ? 100 : 0;
      const progress = getLevelProgress(m.user.totalXp);
      const rank = getRankForLevel(progress.level);

      return {
        userId,
        username: m.user.username,
        avatarEmoji: m.user.avatarEmoji,
        avatarColor: m.user.avatarColor,
        role: m.role,
        level: progress.level,
        rankName: rank.name,
        rankIcon: rank.icon,
        rankColor: rank.color,
        currentStreak: m.user.currentStreak,
        weeklyXp: xpThis,
        tasksCompleted: thisWeekCompletions,
        successRate: scheduled > 0 ? done / scheduled : null,
        improvementPct,
      };
    })
  );

  rows.sort((a, b) => b.weeklyXp - a.weeklyXp);
  const ranked = rows.map((r, i) => ({ ...r, position: i + 1 }));

  const me = ranked.find((r) => r.userId === requestingUserId) ?? null;
  const ahead = me && me.position > 1 ? ranked[me.position - 2] : null;
  const xpToNextPlace = me && ahead ? Math.max(0, ahead.weeklyXp - me.weeklyXp + 1) : null;

  const groupTasksCompleted = ranked.reduce((sum, r) => sum + r.tasksCompleted, 0);

  return {
    week: thisWeek.weekKey,
    members: ranked,
    me,
    xpToNextPlace,
    groupTasksCompleted,
  };
}
