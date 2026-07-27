import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { dayPlanTemplateSchema } from "@/lib/validation";
import { updateTemplate, deleteTemplate, DayPlanError } from "@/lib/dayplan-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = dayPlanTemplateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const template = await updateTemplate(userId, id, parsed.data);
    return NextResponse.json(template);
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  try {
    await deleteTemplate(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    throw err;
  }
}
