import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { dayPlanUpdateSchema } from "@/lib/validation";
import { getDayPlan, updateDayPlan, deleteDayPlan, DayPlanError } from "@/lib/dayplan-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  try {
    const plan = await getDayPlan(userId, id);
    return NextResponse.json(plan);
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    throw err;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = dayPlanUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const plan = await updateDayPlan(userId, id, parsed.data);
    return NextResponse.json(plan);
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "PLAN_NOT_FOUND" ? 404 : 400 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  try {
    await deleteDayPlan(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    throw err;
  }
}
