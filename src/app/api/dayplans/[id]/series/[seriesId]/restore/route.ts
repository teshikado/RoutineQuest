import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { restoreOccurrenceSchema } from "@/lib/validation";
import { restoreSeriesOccurrence, DayPlanError } from "@/lib/dayplan-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; seriesId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, seriesId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = restoreOccurrenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const result = await restoreSeriesOccurrence(userId, id, seriesId, parsed.data.date);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
