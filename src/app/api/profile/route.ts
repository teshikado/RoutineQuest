import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { usernameSchema } from "@/lib/validation";
import { z } from "zod";

const profileSchema = z.object({
  username: usernameSchema,
  avatarEmoji: z.string().min(1).max(8),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ error: "Dieser Benutzername ist bereits vergeben." }, { status: 409 });
  }

  const user = await prisma.user.update({ where: { id: userId }, data: parsed.data });
  return NextResponse.json(user);
}
