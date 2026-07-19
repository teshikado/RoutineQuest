import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership } from "@/lib/group-auth";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; routineId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, routineId } = await params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "Kein Zugriff auf diese Gruppe." }, { status: 403 });

  const routine = await prisma.groupRoutine.findUnique({ where: { id: routineId } });
  if (!routine || routine.groupId !== id || routine.deletedAt) {
    return NextResponse.json({ error: "Gruppenroutine nicht gefunden." }, { status: 404 });
  }
  if (routine.mandatory) {
    return NextResponse.json({ error: "Eine verpflichtende Routine kann nicht verlassen werden." }, { status: 400 });
  }

  const participant = await prisma.groupRoutineParticipant.findUnique({
    where: { groupRoutineId_userId: { groupRoutineId: routineId, userId } },
  });
  if (!participant || participant.status !== "JOINED") {
    return NextResponse.json({ error: "Du nimmst an dieser Routine nicht teil." }, { status: 400 });
  }

  const updated = await prisma.groupRoutineParticipant.update({
    where: { id: participant.id },
    data: { status: "LEFT", leftAt: new Date() },
  });

  return NextResponse.json(updated);
}
