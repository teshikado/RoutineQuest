import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { seriesBlockUpdateSchema } from "@/lib/validation";
import { updateSeriesBlock, deleteSeriesBlock, DayPlanError } from "@/lib/dayplan-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; seriesId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, seriesId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = seriesBlockUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const { includeCustomized, ...patch } = parsed.data;
    const result = await updateSeriesBlock(userId, id, seriesId, patch, { includeCustomized });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; seriesId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, seriesId } = await params;
  const { searchParams } = new URL(req.url);
  const includeCustomized = searchParams.get("includeCustomized") === "true";

  try {
    const result = await deleteSeriesBlock(userId, id, seriesId, { includeCustomized });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
