import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { groupRoutineSchema } from "@/lib/validation";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership, hasRole } from "@/lib/group-auth";
import { getGroupRoutineDetail } from "@/lib/group-routine-data";
import { parseDateKey } from "@/lib/dates";

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
  const parsed = groupRoutineSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const { startDate, endDate, description, timeOfDay, goalTarget, goalType, ...rest } = parsed.data;

  if (startDate) {
    const anyCompletion = await prisma.groupRoutineCompletion.findFirst({ where: { groupRoutineId: routineId } });
    if (anyCompletion) {
      return NextResponse.json(
        { error: "Das Startdatum kann nicht mehr geändert werden, sobald Erledigungen vorliegen." },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.groupRoutine.update({
    where: { id: routineId },
    data: {
      ...rest,
      ...(goalType !== undefined ? { goalType, goalTarget: goalType === "WEEKLY" ? goalTarget ?? null : null } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(timeOfDay !== undefined ? { timeOfDay: timeOfDay || null } : {}),
      ...(startDate ? { startDate: parseDateKey(startDate) } : {}),
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

  await prisma.groupRoutine.update({
    where: { id: routineId },
    data: { deletedAt: new Date(), status: "ENDED", endedAt: routine.endedAt ?? new Date() },
  });

  return NextResponse.json({ success: true });
}
