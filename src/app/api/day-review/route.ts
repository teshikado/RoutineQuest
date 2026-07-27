import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { dayReviewSchema } from "@/lib/validation";
import { getDayReview, upsertDayReview } from "@/lib/dayplan-service";
import { parseDateKey } from "@/lib/dates";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Ungültiges Datum." }, { status: 400 });
  }
  const review = await getDayReview(userId, parseDateKey(date));
  return NextResponse.json(review);
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = dayReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const review = await upsertDayReview(userId, parseDateKey(parsed.data.date), { mood: parsed.data.mood, note: parsed.data.note });
  return NextResponse.json(review);
}
