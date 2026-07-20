import type { Prisma, NotificationType } from "@prisma/client";
import { prisma } from "./prisma";
import { getWeekInfo, isoWeekday, todayDateOnly, zonedStartOfDayUtc } from "./dates";

type TxClient = Prisma.TransactionClient;

/** Creates a notification unless the user has disabled that notification type. Defaults to enabled when no preference row exists yet. */
export async function notify(
  tx: TxClient,
  userId: string,
  type: NotificationType,
  title: string,
  body: string
) {
  const pref = await tx.notificationSetting.findUnique({
    where: { userId_type: { userId, type } },
  });
  if (pref && !pref.enabled) return;

  await tx.notification.create({
    data: { userId, type, title, body },
  });
}

/**
 * Opportunistically generates day-scoped notifications (reminders, streak-at-risk, weekly report)
 * the first time a user loads the dashboard on a given day. There is no background scheduler in
 * this deployment, so this is invoked from the dashboard page instead of a cron job.
 */
export async function generateAmbientNotifications(userId: string) {
  const today = todayDateOnly();
  const weekday = isoWeekday(today);

  const alreadyToday = async (type: NotificationType) =>
    prisma.notification.findFirst({
      where: {
        userId,
        type,
        createdAt: { gte: zonedStartOfDayUtc(today) },
      },
    });

  const scheduledToday = await prisma.routine.findMany({
    where: { userId, archived: false, scheduledDays: { has: weekday } },
  });

  if (scheduledToday.length > 0) {
    const completions = await prisma.completion.findMany({ where: { userId, date: today } });
    const completedIds = new Set(completions.map((c) => c.routineId));
    const openReminders = scheduledToday.filter((r) => r.reminderEnabled && !completedIds.has(r.id));

    if (openReminders.length > 0 && !(await alreadyToday("ROUTINE_REMINDER"))) {
      const pref = await prisma.notificationSetting.findUnique({
        where: { userId_type: { userId, type: "ROUTINE_REMINDER" } },
      });
      if (!pref || pref.enabled) {
        await prisma.notification.create({
          data: {
            userId,
            type: "ROUTINE_REMINDER",
            title: "Anstehende Routinen",
            body:
              openReminders.length === 1
                ? `"${openReminders[0].title}" wartet heute noch auf dich.`
                : `${openReminders.length} Routinen mit Erinnerung warten heute noch auf dich.`,
          },
        });
      }
    }

    const allDone = scheduledToday.every((r) => completedIds.has(r.id));
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!allDone && user && user.currentStreak > 0 && !(await alreadyToday("STREAK_AT_RISK"))) {
      const pref = await prisma.notificationSetting.findUnique({
        where: { userId_type: { userId, type: "STREAK_AT_RISK" } },
      });
      if (!pref || pref.enabled) {
        await prisma.notification.create({
          data: {
            userId,
            type: "STREAK_AT_RISK",
            title: "Deine Erfolgsserie ist in Gefahr",
            body: `Erledige heute noch mindestens 70% deiner Aufgaben, um deine Streak von ${user.currentStreak} Tagen zu sichern.`,
          },
        });
      }
    }
  }

  if (weekday === 1) {
    const lastWeek = getWeekInfo(today, -1);
    const existing = await prisma.notification.findFirst({
      where: { userId, type: "WEEKLY_REPORT", body: { contains: lastWeek.weekKey } },
    });
    if (!existing) {
      const completions = await prisma.completion.findMany({
        where: { userId, date: { gte: lastWeek.start, lte: lastWeek.end } },
      });
      const xp = await prisma.xpTransaction.aggregate({
        where: { userId, refDate: { gte: lastWeek.start, lte: lastWeek.end } },
        _sum: { amount: true },
      });
      const pref = await prisma.notificationSetting.findUnique({
        where: { userId_type: { userId, type: "WEEKLY_REPORT" } },
      });
      if (!pref || pref.enabled) {
        await prisma.notification.create({
          data: {
            userId,
            type: "WEEKLY_REPORT",
            title: "Dein Wochenbericht",
            body: `Letzte Woche (${lastWeek.weekKey}): ${completions.length} Aufgaben erledigt, ${
              xp._sum.amount ?? 0
            } XP gesammelt. Weiter so!`,
          },
        });
      }
    }
  }
}
