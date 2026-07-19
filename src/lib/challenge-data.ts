import { prisma } from "./prisma";
import { addDaysUtc, dateKey } from "./dates";
import type { Challenge } from "@prisma/client";

const BADGE_BY_TYPE: Record<Challenge["type"], { code: string; name: string; description: string; icon: string; color: string }> = {
  TASKS_COUNT: {
    code: "CHALLENGE_TASKS",
    name: "Team-Powerhouse",
    description: "Gemeinsam eine Aufgaben-Challenge gemeistert.",
    icon: "ListChecks",
    color: "#4FA8D8",
  },
  STREAK_DAYS: {
    code: "CHALLENGE_STREAK",
    name: "Unaufhaltsam",
    description: "Als Gruppe an mehreren Tagen in Folge aktiv gewesen.",
    icon: "Flame",
    color: "#FFD166",
  },
  XP_TOTAL: {
    code: "CHALLENGE_XP",
    name: "XP-Kollektiv",
    description: "Gemeinsam ein großes XP-Ziel erreicht.",
    icon: "Sparkles",
    color: "#78D6B0",
  },
  PERFECT_WEEK: {
    code: "CHALLENGE_PERFECT_WEEK",
    name: "Perfekte Gruppe",
    description: "Als Gruppe eine perfekte Woche erreicht.",
    icon: "Crown",
    color: "#A78BFA",
  },
};

async function computeProgress(challenge: Challenge, memberIds: string[]): Promise<number> {
  const today = new Date();
  const rangeEnd = challenge.endDate < today ? challenge.endDate : today;

  switch (challenge.type) {
    case "TASKS_COUNT": {
      return prisma.completion.count({
        where: { userId: { in: memberIds }, date: { gte: challenge.startDate, lte: challenge.endDate } },
      });
    }
    case "XP_TOTAL": {
      const agg = await prisma.xpTransaction.aggregate({
        where: { userId: { in: memberIds }, refDate: { gte: challenge.startDate, lte: challenge.endDate } },
        _sum: { amount: true },
      });
      return agg._sum.amount ?? 0;
    }
    case "STREAK_DAYS": {
      const completions = await prisma.completion.findMany({
        where: { userId: { in: memberIds }, date: { gte: challenge.startDate, lte: rangeEnd } },
        select: { date: true },
      });
      const activeDays = new Set(completions.map((c) => dateKey(c.date)));
      let streak = 0;
      for (let d = challenge.startDate; d <= rangeEnd; d = addDaysUtc(d, 1)) {
        if (activeDays.has(dateKey(d))) streak += 1;
        else break;
      }
      return streak;
    }
    case "PERFECT_WEEK": {
      const perfectWeeks = await prisma.xpTransaction.findMany({
        where: {
          userId: { in: memberIds },
          reason: "PERFECT_WEEK",
          refDate: { gte: challenge.startDate, lte: challenge.endDate },
        },
        select: { userId: true },
      });
      return new Set(perfectWeeks.map((p) => p.userId)).size;
    }
  }
}

export async function evaluateChallenges(groupId: string) {
  const [challenges, members] = await Promise.all([
    prisma.challenge.findMany({ where: { groupId } }),
    prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } }),
  ]);
  const memberIds = members.map((m) => m.userId);

  const results = [];
  for (const challenge of challenges) {
    const progress = await computeProgress(challenge, memberIds);
    const ratio = Math.min(1, progress / challenge.target);
    const justCompleted = !challenge.completed && progress >= challenge.target;

    if (justCompleted) {
      const badgeDef = BADGE_BY_TYPE[challenge.type];
      await prisma.$transaction(async (tx) => {
        await tx.challenge.update({ where: { id: challenge.id }, data: { completed: true, completedAt: new Date() } });
        const badge = await tx.badge.upsert({
          where: { code: badgeDef.code },
          update: {},
          create: badgeDef,
        });
        for (const memberId of memberIds) {
          const existingBadge = await tx.userBadge.findFirst({
            where: { userId: memberId, badgeId: badge.id, challengeId: challenge.id, groupRoutineId: null },
          });
          if (!existingBadge) {
            await tx.userBadge.create({ data: { userId: memberId, badgeId: badge.id, challengeId: challenge.id } });
          }
          await tx.notification.create({
            data: {
              userId: memberId,
              type: "GROUP_CHALLENGE",
              title: "Challenge abgeschlossen!",
              body: `Die Gruppen-Challenge "${challenge.title}" wurde erfolgreich abgeschlossen. Du hast ein Abzeichen erhalten!`,
            },
          });
        }
      });
    }

    results.push({
      ...challenge,
      progress,
      ratio,
      completed: challenge.completed || justCompleted,
    });
  }

  return results;
}
