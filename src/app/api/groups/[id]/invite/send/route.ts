import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership, hasRole } from "@/lib/group-auth";
import { sendMail } from "@/lib/mailer";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const membership = await getMembership(id, userId);
  if (!hasRole(membership?.role, ["OWNER", "ADMIN"])) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { username, email } = body as { username?: string; email?: string };

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: "Gruppe nicht gefunden." }, { status: 404 });

  const invite = await prisma.groupInvite.findFirst({
    where: { groupId: id, revoked: false },
    orderBy: { createdAt: "desc" },
  });
  if (!invite) return NextResponse.json({ error: "Kein aktiver Einladungscode." }, { status: 400 });

  const joinUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/groups/join?code=${invite.code}`;
  const inviter = await prisma.user.findUnique({ where: { id: userId } });

  if (username) {
    const target = await prisma.user.findUnique({ where: { username } });
    if (!target) return NextResponse.json({ error: "Benutzername nicht gefunden." }, { status: 404 });

    const pref = await prisma.notificationSetting.findUnique({
      where: { userId_type: { userId: target.id, type: "GROUP_INVITE" } },
    });
    if (!pref || pref.enabled) {
      await prisma.notification.create({
        data: {
          userId: target.id,
          type: "GROUP_INVITE",
          title: `Einladung zu "${group.name}"`,
          body: `${inviter?.username ?? "Ein Nutzer"} hat dich zur Gruppe "${group.name}" eingeladen. Beitrittscode: ${invite.code}`,
        },
      });
    }
    return NextResponse.json({ ok: true, via: "username" });
  }

  if (email) {
    await sendMail(
      email,
      `RoutineQuest – Einladung zu "${group.name}"`,
      `Du wurdest zur Gruppe "${group.name}" eingeladen!\n\nTrete über diesen Link bei:\n${joinUrl}\n\nOder gib den Beitrittscode manuell ein: ${invite.code}`
    );
    return NextResponse.json({ ok: true, via: "email" });
  }

  return NextResponse.json({ error: "Benutzername oder E-Mail erforderlich." }, { status: 400 });
}
