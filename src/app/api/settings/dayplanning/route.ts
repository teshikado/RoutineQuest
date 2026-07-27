import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ xpForDayPlanning: z.boolean() });

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xpForDayPlanning: true } });
  return NextResponse.json(user);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: { xpForDayPlanning: parsed.data.xpForDayPlanning } });
  return NextResponse.json({ ok: true });
}
