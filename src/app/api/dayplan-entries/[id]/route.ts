import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { dayPlanEntryUpdateSchema } from "@/lib/validation";
import { updateEntry, deleteEntry, DayPlanError } from "@/lib/dayplan-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = dayPlanEntryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }
  // `status` is intentionally not handled here: DONE/undo goes through /complete (it also
  // triggers linked Routine/GroupRoutine XP), and IN_PROGRESS/SKIPPED go through /status.
  const { scope, includeCustomized, ...rest } = parsed.data;
  delete rest.status;

  try {
    const result = await updateEntry(userId, id, rest, scope ?? "THIS", { includeCustomized });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const validScope = scope === "FOLLOWING" || scope === "ALL" ? scope : "THIS";
  const includeCustomized = searchParams.get("includeCustomized") === "true";

  try {
    const result = await deleteEntry(userId, id, validScope, { includeCustomized });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
