import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { groupRoutineBaseSchema } from "@/lib/validation";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership, hasRole } from "@/lib/group-auth";
import { getGroupRoutineDetail } from "@/lib/group-routine-data";
import { parseDateKey, todayDateOnly } from "@/lib/dates";

// Fields that determine which days count as "planned" (and therefore how past days were
// already scored). Once a routine has completions on record, these must stay frozen —
// "Änderungen sollen nur für zukünftige Tage gelten" — otherwise editing them would
// silently rewrite history. Admins who want a genuinely different schedule are expected
// to duplicate the routine with a new period instead.
const SCHEDULE_LOCKING_FIELDS = ["scheduledDays", "difficulty", "xpReward", "category", "goalType", "goalTarget"] as const;

async function requireLeaderRoutine(groupId: string, routineId: string, userId: string) {
  const membership = await getMembership(groupId, userId);
  if (!hasRole(membership?.role, ["OWNER", "ADMIN"])) return null;
  const routine = await prisma.groupRoutine.findUnique({ where: { id: routineId } });
  if (!routine || routine.groupId !== groupId || routine.deletedAt) return null;
  return routine;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; routineId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, routineId } = await params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "Kein Zugriff auf diese Gruppe." }, { status: 403 });

  const detail = await getGroupRoutineDetail(routineId, userId);
  if (!detail || detail.groupId !== id) {
    return NextResponse.json({ error: "Gruppenroutine nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json(detail);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; routineId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, routineId } = await params;

  const routine = await requireLeaderRoutine(id, routineId, userId);
  if (!routine) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = groupRoutineBaseSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const { startDate, endDate, description, timeOfDay, goalTarget, goalType, ...rest } = parsed.data;

  if (goalType === "WEEKLY" && (!goalTarget || goalTarget < 1)) {
    return NextResponse.json({ error: "Bitte gib eine Zielzahl für das Wochenziel an." }, { status: 400 });
  }

  const hasHistory = (await prisma.groupRoutineCompletion.count({ where: { groupRoutineId: routineId } })) > 0;

  if (startDate && hasHistory) {
    return NextResponse.json(
      { error: "Das Startdatum kann nicht mehr geändert werden, sobald Erledigungen vorliegen." },
      { status: 400 }
    );
  }

  if (hasHistory) {
    const attemptedLockedField = SCHEDULE_LOCKING_FIELDS.find(
      (field) => field in rest || (field === "goalType" && goalType !== undefined) || (field === "goalTarget" && goalTarget !== undefined)
    );
    if (attemptedLockedField) {
      return NextResponse.json(
        {
          error:
            "Wochentage, Schwierigkeit, XP, Kategorie und Zusatzziel können nach dem ersten Abhaken nicht mehr geändert werden, damit vergangene Ergebnisse unverändert bleiben. Dupliziere die Routine für ein neues Muster.",
        },
        { status: 400 }
      );
    }
  }

  if (endDate && hasHistory) {
    const newEnd = parseDateKey(endDate);
    if (newEnd < todayDateOnly()) {
      return NextResponse.json(
        { error: "Das Enddatum kann nicht rückwirkend in die Vergangenheit gelegt werden. Nutze stattdessen \"Beenden\"." },
        { status: 400 }
      );
    }
  }

  const safeRest = hasHistory
    ? Object.fromEntries(Object.entries(rest).filter(([key]) => !SCHEDULE_LOCKING_FIELDS.includes(key as (typeof SCHEDULE_LOCKING_FIELDS)[number])))
    : rest;

  const updated = await prisma.groupRoutine.update({
    where: { id: routineId },
    data: {
      ...safeRest,
      ...(!hasHistory && goalType !== undefined ? { goalType, goalTarget: goalType === "WEEKLY" ? goalTarget ?? null : null } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(timeOfDay !== undefined ? { timeOfDay: timeOfDay || null } : {}),
      ...(startDate && !hasHistory ? { startDate: parseDateKey(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? parseDateKey(endDate) : null } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; routineId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, routineId } = await params;

  const routine = await requireLeaderRoutine(id, routineId, userId);
  if (!routine) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

  const hasHistory = (await prisma.groupRoutineCompletion.count({ where: { groupRoutineId: routineId } })) > 0;
  if (hasHistory) {
    return NextResponse.json(
      {
        error:
          "Eine Gruppenroutine mit bereits erledigten Tagen kann nicht gelöscht werden, damit die Ergebnisse sichtbar bleiben. Nutze stattdessen \"Beenden\".",
      },
      { status: 400 }
    );
  }

  await prisma.groupRoutine.update({
    where: { id: routineId },
    data: { deletedAt: new Date(), status: "ENDED", endedAt: routine.endedAt ?? new Date() },
  });

  return NextResponse.json({ success: true });
}
