import type { GroupRoutineAwardType, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { dateKey, getWeekInfo, todayDateOnly } from "./dates";
import { isGroupRoutinePlannedDay } from "./group-routine-data";
import { computeWeeklyTargetProgress } from "./group-routine-weekly";
import { GROUP_ROUTINE_AWARD_META, GROUP_ROUTINE_CHAMPION_BONUS_XP } from "./constants";
import { recomputeTotalXp } from "./completion-service";

type TxClient = Prisma.TransactionClient;

const BADGE_CODES: Record<GroupRoutineAwardType, string> = {
  CHAMPION: "GROUP_ROUTINE_CHAMPION",
  STREAK_MEISTER: "GROUP_ROUTINE_STREAK_MEISTER",
  COMEBACK_STAR: "GROUP_ROUTINE_COMEBACK_STAR",
  TEAMPLAYER: "GROUP_ROUTINE_TEAMPLAYER",
  PERFECT_WOCHE: "GROUP_ROUTINE_PERFECT_WOCHE",
};

async function ensureBadge(tx: TxClient, type: GroupRoutineAwardType) {
  const meta = GROUP_ROUTINE_AWARD_META[type];
  const code = BADGE_CODES[type];
  return tx.badge.upsert({
    where: { code },
    update: {},
    create: { code, name: meta.label, description: meta.description, icon: meta.icon, color: meta.color },
  });
}

async function awardBadge(tx: TxClient, groupRoutineId: string, weekKey: string, userId: string, type: GroupRoutineAwardType) {
  await tx.groupRoutineAward.upsert({
    where: { groupRoutineId_weekKey_type_userId: { groupRoutineId, weekKey, type, userId } },
    update: {},
    create: { groupRoutineId, weekKey, type, userId },
  });
  const badge = await ensureBadge(tx, type);
  const existingBadge = await tx.userBadge.findFirst({
    where: { userId, badgeId: badge.id, groupRoutineId },
  });
  if (!existingBadge) {
    await tx.userBadge.create({ data: { userId, badgeId: badge.id, groupRoutineId } });
  }
}

/**
 * Computes and persists the champion + bonus badges for the calendar week starting at
 * `weekStart` (a Monday, date-only). Idempotent via the CHAMPION award's unique
 * constraint, so it can safely be called repeatedly (page loads, the hourly scheduler).
 */
export async function computeWeeklyAwards(groupRoutineId: string, weekStart: Date) {
  const weekKey = dateKey(weekStart);
  const already = await prisma.groupRoutineAward.findFirst({ where: { groupRoutineId, weekKey, type: "CHAMPION" } });
  if (already) return null;

  const routineOrNull = await prisma.groupRoutine.findUnique({ where: { id: groupRoutineId } });
  if (!routineOrNull || routineOrNull.deletedAt) return null;
  const routine = routineOrNull;

  const week = getWeekInfo(weekStart, 0);
  const previousWeek = getWeekInfo(weekStart, -1);
  if (week.end >= todayDateOnly()) return null; // only score fully-elapsed weeks

  const participants = await prisma.groupRoutineParticipant.findMany({
    where: { groupRoutineId, status: "JOINED", joinedAt: { lte: week.end } },
  });
  if (participants.length === 0) return null;

  const completions = await prisma.groupRoutineCompletion.findMany({
    where: { groupRoutineId, date: { gte: previousWeek.start, lte: week.end } },
  });

  function statsFor(participant: (typeof participants)[number], w: ReturnType<typeof getWeekInfo>) {
    if (routine.goalType === "WEEKLY") {
      const completedDates = new Set(
        completions.filter((c) => c.userId === participant.userId).map((c) => dateKey(c.date))
      );
      const { planned, completed: done } = computeWeeklyTargetProgress(routine, participant, completedDates, w.start, w.end);
      return { planned, done, rate: planned > 0 ? done / planned : null };
    }
    let planned = 0;
    let done = 0;
    for (const d of w.days) {
      if (!isGroupRoutinePlannedDay(routine, participant, d)) continue;
      planned += 1;
      if (completions.some((c) => c.userId === participant.userId && dateKey(c.date) === dateKey(d))) done += 1;
    }
    return { planned, done, rate: planned > 0 ? done / planned : null };
  }

  const rows = participants.map((p) => {
    const cur = statsFor(p, week);
    const prev = statsFor(p, previousWeek);
    const xp = completions
      .filter((c) => c.userId === p.userId && c.date >= week.start && c.date <= week.end)
      .reduce((s, c) => s + c.xpAwarded, 0);
    return {
      userId: p.userId,
      joinedAt: p.joinedAt,
      currentStreak: p.currentStreak,
      planned: cur.planned,
      done: cur.done,
      rate: cur.rate as number | null,
      improvement: cur.rate !== null && prev.rate !== null ? cur.rate - prev.rate : null,
      xp,
    };
  });

  const eligible = rows.filter((r) => r.planned > 0);
  if (eligible.length === 0) return null;

  const champion = [...eligible].sort((a, b) => {
    const rateA = a.rate ?? -1;
    const rateB = b.rate ?? -1;
    if (rateB !== rateA) return rateB - rateA;
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    if (b.done !== a.done) return b.done - a.done;
    if (b.xp !== a.xp) return b.xp - a.xp;
    return (a.joinedAt?.getTime() ?? Infinity) - (b.joinedAt?.getTime() ?? Infinity);
  })[0];

  const streakMeister = [...eligible].sort((a, b) => b.currentStreak - a.currentStreak)[0];
  const comebackStar = eligible
    .filter((r) => (r.improvement ?? 0) > 0)
    .sort((a, b) => (b.improvement ?? 0) - (a.improvement ?? 0))[0];
  const teamplayer = [...eligible].sort((a, b) => b.done - a.done)[0];
  const perfectWeekMembers = eligible.filter((r) => r.rate === 1);

  await prisma.$transaction(async (tx) => {
    await awardBadge(tx, groupRoutineId, weekKey, champion.userId, "CHAMPION");
    await tx.xpTransaction.upsert({
      where: {
        userId_reason_refDate_refId: {
          userId: champion.userId,
          reason: "GROUP_CHAMPION_BONUS",
          refDate: week.start,
          refId: `${groupRoutineId}:${weekKey}`,
        },
      },
      update: {},
      create: {
        userId: champion.userId,
        amount: GROUP_ROUTINE_CHAMPION_BONUS_XP,
        reason: "GROUP_CHAMPION_BONUS",
        refDate: week.start,
        refId: `${groupRoutineId}:${weekKey}`,
      },
    });
    await recomputeTotalXp(tx, champion.userId);

    if (streakMeister) await awardBadge(tx, groupRoutineId, weekKey, streakMeister.userId, "STREAK_MEISTER");
    if (comebackStar) await awardBadge(tx, groupRoutineId, weekKey, comebackStar.userId, "COMEBACK_STAR");
    if (teamplayer) await awardBadge(tx, groupRoutineId, weekKey, teamplayer.userId, "TEAMPLAYER");
    for (const member of perfectWeekMembers) {
      await awardBadge(tx, groupRoutineId, weekKey, member.userId, "PERFECT_WOCHE");
    }

    const championUser = await tx.user.findUnique({ where: { id: champion.userId } });
    await tx.notification.createMany({
      data: participants.map((p) => ({
        userId: p.userId,
        type: "GROUP_ROUTINE_CHAMPION" as const,
        title: "Gruppenroutine-Champion der Woche",
        body: `${championUser?.username ?? "Ein Mitglied"} ist diese Woche Routine-Champion und hat ${Math.round(
          (champion.rate ?? 0) * 100
        )}% der Aufgaben geschafft!`,
      })),
    });
  });

  return { weekKey, championUserId: champion.userId };
}

/** Called on server start and hourly thereafter; scores the most recently fully-elapsed week for every active routine. */
export async function runDueWeeklyAwardChecks() {
  const today = todayDateOnly();
  const lastCompletedWeek = getWeekInfo(today, -1);

  const routines = await prisma.groupRoutine.findMany({ where: { deletedAt: null }, select: { id: true } });
  for (const routine of routines) {
    try {
      await computeWeeklyAwards(routine.id, lastCompletedWeek.start);
    } catch (err) {
      console.error(`[group-routine-awards] failed to score routine ${routine.id}:`, err);
    }
  }
}
