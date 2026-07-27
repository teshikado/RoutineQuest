import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { dayPlanSchema, dayPlanEntrySchema } from "@/lib/validation";
import { createDayPlan, listDayPlans, DayPlanError } from "@/lib/dayplan-service";
import { z } from "zod";

const entriesFieldSchema = z.array(dayPlanEntrySchema).max(50).default([]);

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const plans = await listDayPlans(userId);
  return NextResponse.json(plans);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsedPlan = dayPlanSchema.safeParse(body);
  if (!parsedPlan.success) {
    return NextResponse.json({ error: parsedPlan.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }
  const parsedEntries = entriesFieldSchema.safeParse((body as { entries?: unknown })?.entries);
  if (!parsedEntries.success) {
    return NextResponse.json({ error: parsedEntries.error.issues[0]?.message ?? "Ungültige Zeitblöcke." }, { status: 400 });
  }

  try {
    const result = await createDayPlan(userId, { ...parsedPlan.data, entries: parsedEntries.data });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DayPlanError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    throw err;
  }
}
