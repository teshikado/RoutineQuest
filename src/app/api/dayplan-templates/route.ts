import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { dayPlanTemplateSchema } from "@/lib/validation";
import { createTemplate, listTemplates, DayPlanError } from "@/lib/dayplan-service";

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const templates = await listTemplates(userId);
  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = dayPlanTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const template = await createTemplate(userId, parsed.data);
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
