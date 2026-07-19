import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership } from "@/lib/group-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; routineId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, routineId } = await params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "Kein Zugriff auf diese Gruppe." }, { status: 403 });

  const latest = await prisma.groupRoutineAward.findFirst({
    where: { groupRoutineId: routineId },
    orderBy: { weekKey: "desc" },
  });
  if (!latest) return NextResponse.json({ weekKey: null, awards: [] });

  const awards = await prisma.groupRoutineAward.findMany({
    where: { groupRoutineId: routineId, weekKey: latest.weekKey },
    include: { user: { select: { username: true, avatarEmoji: true } } },
  });

  return NextResponse.json({
    weekKey: latest.weekKey,
    awards: awards.map((a) => ({
      type: a.type,
      userId: a.userId,
      username: a.user.username,
      avatarEmoji: a.user.avatarEmoji,
      meta: a.meta,
    })),
  });
}
