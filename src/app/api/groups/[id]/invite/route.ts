import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership, hasRole } from "@/lib/group-auth";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const membership = await getMembership(id, userId);
  if (!hasRole(membership?.role, ["OWNER", "ADMIN"])) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const invite = await prisma.$transaction(async (tx) => {
    await tx.groupInvite.updateMany({ where: { groupId: id, revoked: false }, data: { revoked: true } });
    return tx.groupInvite.create({ data: { groupId: id, code: nanoid(), createdById: userId } });
  });

  return NextResponse.json(invite);
}
