import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { dayPlanEntryBaseSchema } from "@/lib/validation";
import { addEntryToPlan, DayPlanError } from "@/lib/dayplan-service";

// The entry template posted here has no `date`/`endDate` -- it applies to every date the
// parent DayPlan's recurrence rule matches, with `endsNextDay` deciding per-occurrence
// whether the generated end day is the same as the start day or the one after.
const bodySchema = dayPlanEntryBaseSchema.omit({ date: true, endDate: true });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const result = await addEntryToPlan(userId, id, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
