import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getDayPlan, updateDayPlanMeta, deleteDayPlan, DayPlanError } from "@/lib/dayplan-service";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(300).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().min(1).optional(),
  reminderMinutes: z.number().int().min(0).max(1440).optional().nullable(),
  archived: z.boolean().optional(),
});

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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const plan = await updateDayPlanMeta(userId, id, parsed.data);
    return NextResponse.json(plan);
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
    await deleteDayPlan(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    throw err;
  }
}
