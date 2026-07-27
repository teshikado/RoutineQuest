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
  // No same-day endTime>startTime check here: moveEntry() either takes an explicit
  // endDate/endTime (validated there against the full combined instant, which allows
  // crossing midnight) or omits them entirely and preserves the original duration.

  try {
    const result = await moveEntry(userId, id, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
