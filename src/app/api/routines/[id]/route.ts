import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { routineSchema } from "@/lib/validation";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";

async function loadOwnedRoutine(id: string, userId: string) {
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine || routine.userId !== userId) return null;
  return routine;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const existing = await loadOwnedRoutine(id, userId);
  if (!existing) return NextResponse.json({ error: "Routine nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = routineSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const routine = await prisma.routine.update({ where: { id }, data: parsed.data });
  return NextResponse.json(routine);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const existing = await loadOwnedRoutine(id, userId);
  if (!existing) return NextResponse.json({ error: "Routine nicht gefunden." }, { status: 404 });

  await prisma.routine.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
