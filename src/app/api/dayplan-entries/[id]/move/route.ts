import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { dayPlanEntryMoveSchema } from "@/lib/validation";
import { moveEntry, DayPlanError } from "@/lib/dayplan-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = dayPlanEntryMoveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }
  if (parsed.data.endTime <= parsed.data.startTime) {
    return NextResponse.json({ error: "Die Endzeit muss nach der Startzeit liegen.", code: "INVALID_TIME_RANGE" }, { status: 400 });
  }

  try {
    const result = await moveEntry(userId, id, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
