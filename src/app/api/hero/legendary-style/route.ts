import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { heroLegendaryStyleSchema } from "@/lib/validation";
import { changeLegendaryStyle, HeroError } from "@/lib/hero-service";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = heroLegendaryStyleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    await changeLegendaryStyle(userId, parsed.data.itemId, parsed.data.legendaryStyle);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HeroError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    throw err;
  }
}
