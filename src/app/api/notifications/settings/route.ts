import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { NOTIFICATION_META } from "@/lib/constants";
import type { NotificationType } from "@prisma/client";

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const rows = await prisma.notificationSetting.findMany({ where: { userId } });
  const map = new Map(rows.map((r) => [r.type, r.enabled]));

  const settings = (Object.keys(NOTIFICATION_META) as NotificationType[]).map((type) => ({
    type,
    ...NOTIFICATION_META[type],
    enabled: map.get(type) ?? true,
  }));

  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  if (!body?.type || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const setting = await prisma.notificationSetting.upsert({
    where: { userId_type: { userId, type: body.type } },
    update: { enabled: body.enabled },
    create: { userId, type: body.type, enabled: body.enabled },
  });

  return NextResponse.json(setting);
}
