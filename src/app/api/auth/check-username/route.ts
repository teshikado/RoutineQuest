import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username") ?? "";

  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) {
    return NextResponse.json({ available: false, error: parsed.error.issues[0]?.message });
  }

  const existing = await prisma.user.findUnique({ where: { username: parsed.data } });
  return NextResponse.json({ available: !existing });
}
