import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { addDaysUtc, isFutureDay, todayDateOnly, toDateOnly } from "./dates";
import { getLevelProgress, getRankForLevel } from "./xp";
import { notify } from "./notifications";
import { recomputeTotalXp } from "./completion-service";
import { isGroupRoutinePlannedDay } from "./group-routine-data";

type TxClient = Prisma.TransactionClient;

const UNDO_WINDOW_MINUTES = 10;
const STREAK_LOOKBACK_DAYS = 400;

export class GroupRoutineCompletionError extends Error {}

async function recomputeParticipantStreak(
  tx: TxClient,
  routine: Parameters<typeof isGroupRoutinePlannedDay>[0] & { id: string },
  participantId: string,
  userId: string
): Promise<number> {
  const participant = await tx.groupRoutineParticipant.findUniqueOrThrow({ where: { id: participantId } });
  if (!participant.joinedAt) return 0;

  const today = todayDateOnly();
  const joinedDay = toDateOnly(participant.joinedAt);
  let current = 0;

  if (isGroupRoutinePlannedDay(routine, participant, today)) {
    const doneToday = await tx.groupRoutineCompletion.findUnique({
      where: { groupRoutineId_userId_date: { groupRoutineId: routine.id, userId, date: today } },
    });
    if (doneToday) current += 1;
  }

  let cursor = addDaysUtc(today, -1);
  for (let i = 0; i < STREAK_LOOKBACK_DAYS && cursor >= joinedDay; i++) {
    if (!isGroupRoutinePlannedDay(routine, participant, cursor)) {
      cursor = addDaysUtc(cursor, -1);
      continue;
    }
    const done = await tx.groupRoutineCompletion.findUnique({
      where: { groupRoutineId_userId_date: { groupRoutineId: routine.id, userId, date: cursor } },
    });
    if (!done) break;
    current += 1;
    cursor = addDaysUtc(cursor, -1);
  }

  const longest = Math.max(participant.longestStreak, current);
  await tx.groupRoutineParticipant.update({
    where: { id: participant.id },
    data: { currentStreak: current, longestStreak: longest },
  });
  return current;
}

export type GroupToggleResult = {
  action: "completed" | "uncompleted";
  xpDelta: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  rankedUp: boolean;
  canUndo: boolean;
  currentStreak: number;
};

export async function toggleGroupRoutineCompletion(
  userId: string,
  groupRoutineId: string,
  date: Date
): Promise<GroupToggleResult> {
  if (isFutureDay(date)) {
    throw new GroupRoutineCompletionError("Zukünftige Tage können noch nicht abgehakt werden.");
  }

  return prisma.$transaction(async (tx) => {
    const routine = await tx.groupRoutine.findUnique({ where: { id: groupRoutineId } });
    if (!routine || routine.deletedAt) {
      throw new GroupRoutineCompletionError("Gruppenroutine nicht gefunden.");
    }

    const participant = await tx.groupRoutineParticipant.findUnique({
      where: { groupRoutineId_userId: { groupRoutineId, userId } },
    });
    if (!participant || participant.status !== "JOINED") {
      throw new GroupRoutineCompletionError("Du nimmst an dieser Routine nicht teil.");
    }

    if (!isGroupRoutinePlannedDay(routine, participant, date)) {
      throw new GroupRoutineCompletionError("Diese Routine ist an diesem Tag nicht geplant.");
    }

    const userBefore = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const levelBefore = getLevelProgress(userBefore.totalXp).level;
    const rankBefore = getRankForLevel(levelBefore);

    const existing = await tx.groupRoutineCompletion.findUnique({
      where: { groupRoutineId_userId_date: { groupRoutineId, userId, date } },
    });

    let action: "completed" | "uncompleted";
    let xpDelta = 0;
    let canUndo = true;

    if (!existing) {
      const completion = await tx.groupRoutineCompletion.create({
        data: { groupRoutineId, userId, date, xpAwarded: routine.xpReward },
      });
      await tx.xpTransaction.create({
        data: { userId, amount: routine.xpReward, reason: "GROUP_TASK_COMPLETE", refDate: date, refId: completion.id },
      });
      action = "completed";
      xpDelta = routine.xpReward;
    } else {
      const ageMs = Date.now() - existing.createdAt.getTime();
      if (ageMs > UNDO_WINDOW_MINUTES * 60 * 1000) {
        throw new GroupRoutineCompletionError(
          `Diese Erledigung kann nur innerhalb von ${UNDO_WINDOW_MINUTES} Minuten rückgängig gemacht werden.`
        );
      }
      const relatedTx = await tx.xpTransaction.findUnique({
        where: {
          userId_reason_refDate_refId: { userId, reason: "GROUP_TASK_COMPLETE", refDate: date, refId: existing.id },
        },
      });
      if (relatedTx) await tx.xpTransaction.delete({ where: { id: relatedTx.id } });
      await tx.groupRoutineCompletion.delete({ where: { id: existing.id } });
      action = "uncompleted";
      xpDelta = -(relatedTx?.amount ?? existing.xpAwarded);
      canUndo = false;
    }

    const currentStreak = await recomputeParticipantStreak(tx, routine, participant.id, userId);
    const totalXp = await recomputeTotalXp(tx, userId);

    const levelAfter = getLevelProgress(totalXp).level;
    const rankAfter = getRankForLevel(levelAfter);
    const leveledUp = levelAfter > levelBefore;
    const rankedUp = rankAfter.key !== rankBefore.key && levelAfter > levelBefore;

    if (leveledUp) {
      await notify(
        tx,
        userId,
        "LEVEL_UP",
        `Level Up! Du bist jetzt Level ${levelAfter}.`,
        rankedUp ? `Du bist jetzt ${rankAfter.name}.` : "Weiter so!"
      );
    }
    if (rankedUp) {
      await notify(tx, userId, "RANK_UP", `Rangaufstieg: ${rankAfter.name}!`, rankAfter.description);
    }

    return {
      action,
      xpDelta,
      totalXp,
      level: levelAfter,
      leveledUp,
      rankedUp,
      canUndo: action === "completed" && canUndo,
      currentStreak,
    };
  });
}
