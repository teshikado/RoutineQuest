import type { GroupRoutine, GroupRoutineParticipant, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { DIFFICULTY_META } from "./constants";
import { addDaysUtc, dateKey, isFutureDay, isoWeekday, todayDateOnly, toDateOnly, type WeekInfo } from "./dates";

type TxClient = Prisma.TransactionClient;

/**
 * A day counts as "planned" for a participant only once they've actually joined the
 * routine (fairness: later joiners aren't penalized for days before they could take
 * part), and stops counting once the routine is paused/ended from that point forward.
 * Past days keep their original outcome even after a later pause/edit/end.
 */
export function isGroupRoutinePlannedDay(
  routine: Pick<GroupRoutine, "scheduledDays" | "startDate" | "endDate" | "status" | "pausedAt" | "endedAt">,
  participant: Pick<GroupRoutineParticipant, "joinedAt"> | null,
  day: Date
): boolean {
  if (!participant?.joinedAt) return false;

  const weekday = isoWeekday(day);
  if (!routine.scheduledDays.includes(weekday)) return false;
  if (day < toDateOnly(routine.startDate)) return false;
  if (routine.endDate && day > toDateOnly(routine.endDate)) return false;
  if (day < toDateOnly(participant.joinedAt)) return false;

  const today = todayDateOnly();
  if (routine.status === "PAUSED" && day >= today) return false;
  if (routine.status === "ENDED" && routine.endedAt && day >= toDateOnly(routine.endedAt)) return false;

  return true;
}

/**
 * Flips ACTIVE/PAUSED routines whose endDate has fully passed into ENDED, so they move
 * to "Beendete Routinen" and stop accepting new completions. `endedAt` is set to the day
 * after `endDate` so the ENDED-status gate in `isGroupRoutinePlannedDay` agrees exactly
 * with the endDate gate — the end date itself stays a valid, already-decided past day.
 * Idempotent, safe to call on every read.
 */
export async function autoEndDueRoutines(groupId: string) {
  const today = todayDateOnly();
  const dueRoutines = await prisma.groupRoutine.findMany({
    where: { groupId, deletedAt: null, status: { in: ["ACTIVE", "PAUSED"] }, endDate: { lt: today } },
    select: { id: true, endDate: true },
  });
  await Promise.all(
    dueRoutines.map((r) =>
      prisma.groupRoutine.update({
        where: { id: r.id },
        data: { status: "ENDED", endedAt: addDaysUtc(toDateOnly(r.endDate!), 1) },
      })
    )
  );
}

/** Creates PENDING participation rows for members who don't have one yet on ALL_MEMBERS routines they can already see. */
export async function ensurePendingParticipation(groupId: string, userId: string) {
  const routines = await prisma.groupRoutine.findMany({
    where: { groupId, deletedAt: null, status: { not: "ENDED" }, visibility: "ALL_MEMBERS" },
    include: { participants: { where: { userId } } },
  });

  const missing = routines.filter((r) => r.participants.length === 0);
  if (missing.length === 0) return;

  await Promise.all(
    missing.map(async (routine) => {
      if (routine.mandatory) {
        await prisma.groupRoutineParticipant.create({
          data: { groupRoutineId: routine.id, userId, status: "JOINED", respondedAt: new Date(), joinedAt: new Date() },
        });
      } else {
        await prisma.groupRoutineParticipant.create({
          data: { groupRoutineId: routine.id, userId, status: "PENDING" },
        });
        await prisma.notification.create({
          data: {
            userId,
            type: "GROUP_ROUTINE_ADDED",
            title: "Neue Gruppenroutine",
            body: `"${routine.title}" wartet auf deine Antwort: teilnehmen, ablehnen oder später entscheiden.`,
          },
        });
      }
    })
  );
}

/** Seeds participation for every current group member when a leader creates a new routine. */
export async function seedParticipantsForNewRoutine(tx: TxClient, routine: GroupRoutine, creatorId: string) {
  const members = await tx.groupMember.findMany({ where: { groupId: routine.groupId }, select: { userId: true } });

  if (routine.mandatory) {
    await tx.groupRoutineParticipant.createMany({
      data: members.map((m) => ({
        groupRoutineId: routine.id,
        userId: m.userId,
        status: "JOINED" as const,
        respondedAt: new Date(),
        joinedAt: new Date(),
      })),
    });
    return;
  }

  await tx.groupRoutineParticipant.create({
    data: { groupRoutineId: routine.id, userId: creatorId, status: "JOINED", respondedAt: new Date(), joinedAt: new Date() },
  });

  const others = members.filter((m) => m.userId !== creatorId);
  if (others.length === 0) return;

  await tx.groupRoutineParticipant.createMany({
    data: others.map((m) => ({ groupRoutineId: routine.id, userId: m.userId, status: "PENDING" as const })),
  });

  if (routine.visibility === "ALL_MEMBERS") {
    await tx.notification.createMany({
      data: others.map((m) => ({
        userId: m.userId,
        type: "GROUP_ROUTINE_ADDED" as const,
        title: "Neue Gruppenroutine",
        body: `"${routine.title}" wurde gestartet. Machst du mit?`,
      })),
    });
  }
}

export function defaultXpReward(difficulty: keyof typeof DIFFICULTY_META): number {
  return DIFFICULTY_META[difficulty].xp;
}

export type GroupRoutineBucket = "upcoming" | "active" | "ended";

/** Which of the three "Gruppenroutinen" sections a routine belongs in, plus "Tag X von Y" / "Noch N Tage" figures. */
export function getGroupRoutinePeriodInfo(routine: Pick<GroupRoutine, "startDate" | "endDate" | "status">) {
  const today = todayDateOnly();
  const start = toDateOnly(routine.startDate);
  const end = routine.endDate ? toDateOnly(routine.endDate) : null;
  const msPerDay = 24 * 60 * 60 * 1000;

  const bucket: GroupRoutineBucket =
    routine.status === "ENDED" || (end !== null && today > end) ? "ended" : today < start ? "upcoming" : "active";

  const totalDays = end ? Math.round((end.getTime() - start.getTime()) / msPerDay) + 1 : null;
  const rawDayNumber = Math.round((today.getTime() - start.getTime()) / msPerDay) + 1;
  const dayNumber =
    bucket === "upcoming" ? null : totalDays !== null ? Math.min(rawDayNumber, totalDays) : Math.max(rawDayNumber, 1);
  const daysRemaining = end !== null && bucket === "active" ? Math.max(0, Math.round((end.getTime() - today.getTime()) / msPerDay)) : null;

  return { bucket, dayNumber, totalDays, daysRemaining };
}

export async function getGroupRoutineList(groupId: string, userId: string) {
  await autoEndDueRoutines(groupId);
  await ensurePendingParticipation(groupId, userId);

  const membership = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  const isLeader = membership?.role === "OWNER" || membership?.role === "ADMIN";

  const routines = await prisma.groupRoutine.findMany({
    where: {
      groupId,
      deletedAt: null,
      OR: isLeader
        ? undefined
        : [{ visibility: "ALL_MEMBERS" }, { participants: { some: { userId } } }],
    },
    include: {
      participants: { where: { userId } },
      _count: { select: { participants: { where: { status: "JOINED" } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return routines.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    icon: r.icon,
    color: r.color,
    category: r.category,
    difficulty: r.difficulty,
    xpReward: r.xpReward,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate?.toISOString() ?? null,
    scheduledDays: r.scheduledDays,
    timeOfDay: r.timeOfDay,
    visibility: r.visibility,
    mandatory: r.mandatory,
    goalType: r.goalType,
    goalTarget: r.goalTarget,
    status: r.status,
    participantCount: r._count.participants,
    myParticipation: r.participants[0]
      ? { status: r.participants[0].status, joinedAt: r.participants[0].joinedAt?.toISOString() ?? null }
      : null,
    ...getGroupRoutinePeriodInfo(r),
  }));
}

export async function getGroupRoutineDetail(groupRoutineId: string, userId: string) {
  const routineForGroup = await prisma.groupRoutine.findUnique({
    where: { id: groupRoutineId },
    select: { groupId: true },
  });
  if (routineForGroup) await autoEndDueRoutines(routineForGroup.groupId);

  const routine = await prisma.groupRoutine.findUnique({
    where: { id: groupRoutineId },
    include: {
      group: { select: { id: true, name: true, icon: true, color: true } },
      participants: { where: { userId } },
    },
  });
  if (!routine || routine.deletedAt) return null;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: routine.groupId, userId } },
  });
  if (!membership) return null;

  const isLeader = membership.role === "OWNER" || membership.role === "ADMIN";
  const myParticipation = routine.participants[0] ?? null;

  if (routine.visibility === "PARTICIPANTS_ONLY" && !isLeader && !myParticipation) return null;

  const today = todayDateOnly();
  let todayStatus: "done" | "open" | "missed" | "not_scheduled" = "not_scheduled";
  if (myParticipation?.status === "JOINED" && isGroupRoutinePlannedDay(routine, myParticipation, today)) {
    const doneToday = await prisma.groupRoutineCompletion.findUnique({
      where: { groupRoutineId_userId_date: { groupRoutineId, userId, date: today } },
    });
    todayStatus = doneToday ? "done" : "open";
  }

  const completionCount = isLeader
    ? await prisma.groupRoutineCompletion.count({ where: { groupRoutineId } })
    : 0;

  return {
    id: routine.id,
    groupId: routine.groupId,
    group: routine.group,
    title: routine.title,
    description: routine.description,
    icon: routine.icon,
    color: routine.color,
    category: routine.category,
    difficulty: routine.difficulty,
    xpReward: routine.xpReward,
    startDate: routine.startDate.toISOString(),
    endDate: routine.endDate?.toISOString() ?? null,
    scheduledDays: routine.scheduledDays,
    timeOfDay: routine.timeOfDay,
    visibility: routine.visibility,
    mandatory: routine.mandatory,
    goalType: routine.goalType,
    goalTarget: routine.goalTarget,
    status: routine.status,
    createdById: routine.createdById,
    isLeader,
    canDelete: isLeader && completionCount === 0,
    todayStatus,
    myParticipation: myParticipation
      ? {
          status: myParticipation.status,
          joinedAt: myParticipation.joinedAt?.toISOString() ?? null,
          currentStreak: myParticipation.currentStreak,
          longestStreak: myParticipation.longestStreak,
        }
      : null,
    ...getGroupRoutinePeriodInfo(routine),
  };
}

export type GroupRoutineListItem = Awaited<ReturnType<typeof getGroupRoutineList>>[number];
export type GroupRoutineDetail = NonNullable<Awaited<ReturnType<typeof getGroupRoutineDetail>>>;

/** Joined group routines scheduled for the user on `date`, for merging into the personal day board. */
export async function getGroupRoutineDayBoard(userId: string, date: Date) {
  const participants = await prisma.groupRoutineParticipant.findMany({
    where: { userId, status: "JOINED" },
    include: { groupRoutine: { include: { group: { select: { id: true, name: true, icon: true, color: true } } } } },
  });

  const relevant = participants.filter(
    (p) => !p.groupRoutine.deletedAt && isGroupRoutinePlannedDay(p.groupRoutine, p, date)
  );
  if (relevant.length === 0) return [];

  const completions = await prisma.groupRoutineCompletion.findMany({
    where: { userId, date, groupRoutineId: { in: relevant.map((p) => p.groupRoutineId) } },
  });

  return relevant.map((p) => ({
    groupRoutine: p.groupRoutine,
    group: p.groupRoutine.group,
    completed: completions.some((c) => c.groupRoutineId === p.groupRoutineId),
    completion: completions.find((c) => c.groupRoutineId === p.groupRoutineId) ?? null,
  }));
}

export type GroupRoutineDayBoardRow = Awaited<ReturnType<typeof getGroupRoutineDayBoard>>[number];

/** Joined group routines merged into the personal weekly plan, in the same day-status shape as personal routines. */
export async function getGroupRoutineWeekRows(userId: string, week: WeekInfo) {
  const participants = await prisma.groupRoutineParticipant.findMany({
    where: { userId, status: "JOINED" },
    include: { groupRoutine: { include: { group: { select: { id: true, name: true, icon: true, color: true } } } } },
  });
  const relevant = participants.filter((p) => !p.groupRoutine.deletedAt);
  if (relevant.length === 0) return [];

  const completions = await prisma.groupRoutineCompletion.findMany({
    where: { userId, date: { gte: week.start, lte: week.end }, groupRoutineId: { in: relevant.map((p) => p.groupRoutineId) } },
  });

  return relevant
    .map((p) => {
      const routine = p.groupRoutine;
      const days = week.days.map((day) => {
        if (!isGroupRoutinePlannedDay(routine, p, day)) return "not_scheduled" as const;
        const done = completions.some((c) => c.groupRoutineId === routine.id && dateKey(c.date) === dateKey(day));
        if (done) return "done" as const;
        if (isFutureDay(day)) return "open" as const;
        return "missed" as const;
      });

      const resolvedCount = days.filter((d) => d === "done" || d === "missed").length;
      const doneCount = days.filter((d) => d === "done").length;
      const successRate = resolvedCount > 0 ? doneCount / resolvedCount : null;
      const xpCollected = completions
        .filter((c) => c.groupRoutineId === routine.id)
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
        groupBadge: { name: routine.group.name, icon: routine.group.icon, color: routine.group.color },
      };
    })
    .filter((row) => row.days.some((d) => d !== "not_scheduled"));
}
