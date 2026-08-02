import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { heroCharacterSchema } from "@/lib/validation";
import { completeCharacterSetup } from "@/lib/hero-service";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = heroCharacterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  const profile = await completeCharacterSetup(userId, {
    heroName: parsed.data.heroName?.trim() || null,
    characterType: parsed.data.characterType,
    skinTone: parsed.data.skinTone,
    hairColor: parsed.data.hairColor,
    hairStyle: parsed.data.hairStyle,
    bodyBuild: parsed.data.bodyBuild,
  });

  return NextResponse.json({ profile });
}
