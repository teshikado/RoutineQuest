import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const code = (body?.code as string | undefined)?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Bitte gib einen Einladungscode ein." }, { status: 400 });

  const invite = await prisma.groupInvite.findUnique({ where: { code }, include: { group: true } });
  if (!invite || invite.revoked || (invite.expiresAt && invite.expiresAt < new Date())) {
    return NextResponse.json({ error: "Dieser Einladungscode ist ungültig oder abgelaufen." }, { status: 400 });
  }
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    return NextResponse.json({ error: "Dieser Einladungscode wurde bereits zu oft verwendet." }, { status: 400 });
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: invite.groupId, userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Du bist bereits Mitglied dieser Gruppe.", groupId: invite.groupId }, { status: 409 });
  }

  if (invite.group.maxMembers !== null) {
    const memberCount = await prisma.groupMember.count({ where: { groupId: invite.groupId } });
    if (memberCount >= invite.group.maxMembers) {
      return NextResponse.json({ error: "Diese Gruppe hat die maximale Mitgliederzahl erreicht." }, { status: 400 });
    }
  }

  await prisma.$transaction([
    prisma.groupMember.create({ data: { groupId: invite.groupId, userId, role: "MEMBER" } }),
    prisma.groupInvite.update({ where: { id: invite.id }, data: { useCount: { increment: 1 } } }),
  ]);

  return NextResponse.json({ ok: true, groupId: invite.groupId, groupName: invite.group.name });
}
