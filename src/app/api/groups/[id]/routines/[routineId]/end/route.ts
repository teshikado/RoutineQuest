import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership, hasRole } from "@/lib/group-auth";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; routineId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, routineId } = await params;

  const membership = await getMembership(id, userId);
  if (!hasRole(membership?.role, ["OWNER", "ADMIN"])) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const routine = await prisma.groupRoutine.findUnique({ where: { id: routineId } });
  if (!routine || routine.groupId !== id || routine.deletedAt) {
    return NextResponse.json({ error: "Gruppenroutine nicht gefunden." }, { status: 404 });
  }
  if (routine.status === "ENDED") {
    return NextResponse.json({ error: "Diese Routine ist bereits beendet." }, { status: 400 });
  }

  const updated = await prisma.groupRoutine.update({
    where: { id: routineId },
    data: { status: "ENDED", endedAt: new Date() },
  });

  return NextResponse.json(updated);
}
