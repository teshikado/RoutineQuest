import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { groupSchema } from "@/lib/validation";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: { include: { _count: { select: { members: true } } } } },
  });

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      description: m.group.description,
      icon: m.group.icon,
      color: m.group.color,
      memberCount: m.group._count.members,
      role: m.role,
      isPrivate: m.group.isPrivate,
    }))
  );
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = groupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.group.create({ data: { ...parsed.data, ownerId: userId } });
    await tx.groupMember.create({ data: { groupId: g.id, userId, role: "OWNER" } });
    await tx.groupInvite.create({ data: { groupId: g.id, code: nanoid(), createdById: userId } });
    return g;
  });

  return NextResponse.json(group, { status: 201 });
}
