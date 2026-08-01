import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { feedPet, HeroError } from "@/lib/hero-service";

export async function POST() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  try {
    const result = await feedPet(userId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HeroError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    throw err;
  }
}
