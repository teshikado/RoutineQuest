import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { quickAddEntrySchema } from "@/lib/validation";
import { createStandaloneEntry, durationMinutes, DayPlanError } from "@/lib/dayplan-service";
import { DAYPLAN_CATEGORY_META } from "@/lib/dayplan-constants";

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = quickAddEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const endTime = addMinutesToTime(parsed.data.startTime, parsed.data.durationMinutes);
  if (endTime <= parsed.data.startTime) {
    return NextResponse.json({ error: "Die Dauer führt über Mitternacht hinaus. Bitte eine kürzere Dauer wählen.", code: "INVALID_TIME_RANGE" }, { status: 400 });
  }

  try {
    const result = await createStandaloneEntry(userId, {
      title: parsed.data.title,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      endTime,
      category: "OTHER",
      priority: "NORMAL",
      color: DAYPLAN_CATEGORY_META.OTHER.color,
      icon: DAYPLAN_CATEGORY_META.OTHER.icon,
    });
    return NextResponse.json({ ...result, durationMinutes: durationMinutes(parsed.data.startTime, endTime) }, { status: 201 });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
