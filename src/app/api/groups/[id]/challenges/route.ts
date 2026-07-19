import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { challengeSchema } from "@/lib/validation";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership, hasRole } from "@/lib/group-auth";
import { evaluateChallenges } from "@/lib/challenge-data";
import { parseDateKey } from "@/lib/dates";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "Kein Zugriff auf diese Gruppe." }, { status: 403 });

  const results = await evaluateChallenges(id);
  return NextResponse.json(results);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const membership = await getMembership(id, userId);
  if (!hasRole(membership?.role, ["OWNER", "ADMIN"])) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = challengeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const { startDate, endDate, ...rest } = parsed.data;
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (end < start) {
    return NextResponse.json({ error: "Das Enddatum muss nach dem Startdatum liegen." }, { status: 400 });
  }

  const challenge = await prisma.challenge.create({
    data: { ...rest, groupId: id, startDate: start, endDate: end },
  });

  const members = await prisma.groupMember.findMany({ where: { groupId: id }, select: { userId: true } });
  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      type: "GROUP_CHALLENGE" as const,
      title: "Neue Gruppen-Challenge",
      body: `Die Challenge "${challenge.title}" wurde gestartet!`,
    })),
  });

  return NextResponse.json(challenge, { status: 201 });
}
