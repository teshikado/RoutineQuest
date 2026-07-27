import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { quickAddEntrySchema } from "@/lib/validation";
import { createStandaloneEntry, DayPlanError } from "@/lib/dayplan-service";
import { DAYPLAN_CATEGORY_META } from "@/lib/dayplan-constants";

/** Duration-based end time that correctly rolls into the next day instead of clamping at
 * 23:59 -- "22:00 Uhr für 240 Minuten" must produce 02:00 the next day, not a truncated
 * same-day block. */
function addMinutes(time: string, minutes: number): { time: string; nextDay: boolean } {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nextDay = total >= 24 * 60;
  const minutesOfDay = total % (24 * 60);
  return { time: `${String(Math.floor(minutesOfDay / 60)).padStart(2, "0")}:${String(minutesOfDay % 60).padStart(2, "0")}`, nextDay };
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = quickAddEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const { time: endTime, nextDay } = addMinutes(parsed.data.startTime, parsed.data.durationMinutes);

  try {
    const result = await createStandaloneEntry(userId, {
      title: parsed.data.title,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      endTime,
      endsNextDay: nextDay,
      category: "OTHER",
      priority: "NORMAL",
      color: DAYPLAN_CATEGORY_META.OTHER.color,
      icon: DAYPLAN_CATEGORY_META.OTHER.icon,
    });
    return NextResponse.json({ ...result, durationMinutes: parsed.data.durationMinutes }, { status: 201 });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
