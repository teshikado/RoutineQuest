import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => ({}));

  if (body.all) {
    await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }

  if (typeof body.id === "string") {
    await prisma.notification.updateMany({ where: { id: body.id, userId }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
}
