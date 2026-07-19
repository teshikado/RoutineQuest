import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership, hasRole } from "@/lib/group-auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const currentUserId = await requireUserId();
  if (isErrorResponse(currentUserId)) return currentUserId;
  const { id, userId: targetUserId } = await params;

  const membership = await getMembership(id, currentUserId);
  const target = await getMembership(id, targetUserId);
  if (!target) return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });

  const isSelf = currentUserId === targetUserId;
  const canManage = hasRole(membership?.role, ["OWNER", "ADMIN"]);

  if (!isSelf && !canManage) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }
  if (target.role === "OWNER") {
    return NextResponse.json({ error: "Der Besitzer kann nicht entfernt werden." }, { status: 400 });
  }
  if (!isSelf && target.role === "ADMIN" && membership?.role !== "OWNER") {
    return NextResponse.json({ error: "Nur der Besitzer kann Administratoren entfernen." }, { status: 403 });
  }

  await prisma.groupMember.delete({ where: { groupId_userId: { groupId: id, userId: targetUserId } } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const currentUserId = await requireUserId();
  if (isErrorResponse(currentUserId)) return currentUserId;
  const { id, userId: targetUserId } = await params;

  const membership = await getMembership(id, currentUserId);
  if (!hasRole(membership?.role, ["OWNER"])) {
    return NextResponse.json({ error: "Nur der Besitzer kann Rollen ändern." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const role = body?.role;
  if (role !== "ADMIN" && role !== "MEMBER") {
    return NextResponse.json({ error: "Ungültige Rolle." }, { status: 400 });
  }

  const target = await getMembership(id, targetUserId);
  if (!target || target.role === "OWNER") {
    return NextResponse.json({ error: "Ungültiges Zielmitglied." }, { status: 400 });
  }

  const updated = await prisma.groupMember.update({
    where: { groupId_userId: { groupId: id, userId: targetUserId } },
    data: { role },
  });
  return NextResponse.json(updated);
}
