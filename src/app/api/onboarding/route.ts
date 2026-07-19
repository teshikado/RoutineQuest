import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { onboardingSchema } from "@/lib/validation";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const { username, avatarEmoji, avatarColor } = parsed.data;

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername && existingUsername.id !== userId) {
    return NextResponse.json({ error: "Dieser Benutzername ist bereits vergeben." }, { status: 409 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { username, avatarEmoji, avatarColor, onboarded: true },
  });

  return NextResponse.json(user);
}
