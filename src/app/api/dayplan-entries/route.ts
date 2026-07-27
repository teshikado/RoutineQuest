import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { dayPlanEntrySchema } from "@/lib/validation";
import { createStandaloneEntry, getEntriesForRange, DayPlanError } from "@/lib/dayplan-service";
import { parseDateKey } from "@/lib/dates";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return NextResponse.json({ error: "Ungültiger Zeitraum." }, { status: 400 });
  }

  const entries = await getEntriesForRange(userId, parseDateKey(start), parseDateKey(end));
  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = dayPlanEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const result = await createStandaloneEntry(userId, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
