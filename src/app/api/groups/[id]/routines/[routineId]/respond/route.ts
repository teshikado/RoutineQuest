import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { participationResponseSchema } from "@/lib/validation";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership } from "@/lib/group-auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; routineId: string }> }) {
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
    return NextResponse.json({ error: "Diese Routine ist verpflichtend und erfordert keine Antwort." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = participationResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  const existing = await prisma.groupRoutineParticipant.findUnique({
    where: { groupRoutineId_userId: { groupRoutineId: routineId, userId } },
  });

  const now = new Date();
  const data =
    parsed.data.decision === "JOIN"
      ? existing?.status === "JOINED"
        ? { status: "JOINED" as const, respondedAt: now }
        : { status: "JOINED" as const, respondedAt: now, joinedAt: now, leftAt: null }
      : parsed.data.decision === "DECLINE"
        ? { status: "DECLINED" as const, respondedAt: now }
        : { status: "PENDING" as const, respondedAt: now };

  const participant = await prisma.groupRoutineParticipant.upsert({
    where: { groupRoutineId_userId: { groupRoutineId: routineId, userId } },
    update: data,
    create: { groupRoutineId: routineId, userId, ...data },
  });

  return NextResponse.json(participant);
}
