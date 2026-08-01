import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { heroPetSelectSchema } from "@/lib/validation";
import { selectPet, HeroError } from "@/lib/hero-service";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = heroPetSelectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const pet = await selectPet(userId, parsed.data.species);
    return NextResponse.json({ pet });
  } catch (err) {
    if (err instanceof HeroError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    throw err;
  }
}
