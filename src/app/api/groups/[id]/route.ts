import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { groupSchema } from "@/lib/validation";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership, hasRole } from "@/lib/group-auth";
import { getLevelProgress, getRankForLevel } from "@/lib/xp";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "Kein Zugriff auf diese Gruppe." }, { status: 403 });

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
      invites: { where: { revoked: false }, orderBy: { createdAt: "desc" }, take: 1 },
      challenges: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!group) return NextResponse.json({ error: "Gruppe nicht gefunden." }, { status: 404 });

  return NextResponse.json({
    id: group.id,
    name: group.name,
    description: group.description,
    icon: group.icon,
    color: group.color,
    ownerId: group.ownerId,
    maxMembers: group.maxMembers,
    isPrivate: group.isPrivate,
    myRole: membership.role,
    activeInviteCode: group.invites[0]?.code ?? null,
    challenges: group.challenges,
    members: group.members.map((m) => {
      const progress = getLevelProgress(m.user.totalXp);
      const rank = getRankForLevel(progress.level);
      return {
        userId: m.userId,
        username: m.user.username,
        avatarEmoji: m.user.avatarEmoji,
        avatarColor: m.user.avatarColor,
        role: m.role,
        level: progress.level,
        rank: rank.name,
        rankIcon: rank.icon,
        rankColor: rank.color,
        currentStreak: m.user.currentStreak,
        joinedAt: m.joinedAt,
      };
    }),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const membership = await getMembership(id, userId);
  if (!hasRole(membership?.role, ["OWNER", "ADMIN"])) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = groupSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const group = await prisma.group.update({ where: { id }, data: parsed.data });
  return NextResponse.json(group);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const membership = await getMembership(id, userId);
  if (!hasRole(membership?.role, ["OWNER"])) {
    return NextResponse.json({ error: "Nur der Besitzer kann die Gruppe löschen." }, { status: 403 });
  }

  await prisma.group.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
