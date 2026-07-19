import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine || routine.userId !== userId) {
    return NextResponse.json({ error: "Routine nicht gefunden." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const archived = body.archived !== false;

  const updated = await prisma.routine.update({
    where: { id },
    data: { archived, archivedAt: archived ? new Date() : null },
  });
  return NextResponse.json(updated);
}
