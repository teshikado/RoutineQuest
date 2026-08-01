import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { heroItemActionSchema } from "@/lib/validation";
import { toggleFavoriteItem, HeroError } from "@/lib/hero-service";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = heroItemActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const item = await toggleFavoriteItem(userId, parsed.data.itemId);
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof HeroError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "ITEM_NOT_OWNED" ? 403 : 400 });
    }
    throw err;
  }
}
