import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { groupRoutineSchema } from "@/lib/validation";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership, hasRole } from "@/lib/group-auth";
import { getGroupRoutineList, seedParticipantsForNewRoutine } from "@/lib/group-routine-data";
import { parseDateKey } from "@/lib/dates";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "Kein Zugriff auf diese Gruppe." }, { status: 403 });

  const routines = await getGroupRoutineList(id, userId);
  return NextResponse.json(routines);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const membership = await getMembership(id, userId);
  if (!hasRole(membership?.role, ["OWNER", "ADMIN"])) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = groupRoutineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const { startDate, endDate, description, timeOfDay, goalTarget, ...rest } = parsed.data;
  const start = parseDateKey(startDate);
  const end = endDate ? parseDateKey(endDate) : null;
  if (end && end < start) {
    return NextResponse.json({ error: "Das Enddatum muss nach dem Startdatum liegen." }, { status: 400 });
  }

  const routine = await prisma.$transaction(async (tx) => {
    const created = await tx.groupRoutine.create({
      data: {
        ...rest,
        description: description || null,
        timeOfDay: timeOfDay || null,
        goalTarget: rest.goalType === "WEEKLY" ? goalTarget ?? null : null,
        groupId: id,
        createdById: userId,
        startDate: start,
        endDate: end,
      },
    });
    await seedParticipantsForNewRoutine(tx, created, userId);
    return created;
  });

  return NextResponse.json(routine, { status: 201 });
}
