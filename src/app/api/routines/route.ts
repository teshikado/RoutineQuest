import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { routineSchema } from "@/lib/validation";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("archived") === "true";

  const routines = await prisma.routine.findMany({
    where: { userId, archived: includeArchived ? undefined : false },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(routines);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = routineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const routine = await prisma.routine.create({
    data: { ...parsed.data, userId },
  });
  return NextResponse.json(routine, { status: 201 });
}
