import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership } from "@/lib/group-auth";
import { toggleGroupRoutineCompletion, GroupRoutineCompletionError } from "@/lib/group-routine-completion-service";
import { parseDateKey } from "@/lib/dates";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; routineId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, routineId } = await params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "Kein Zugriff auf diese Gruppe." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const dateStr = body?.date;
  if (typeof dateStr !== "string") {
    return NextResponse.json({ error: "Datum fehlt." }, { status: 400 });
  }

  try {
    const result = await toggleGroupRoutineCompletion(userId, routineId, parseDateKey(dateStr));
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GroupRoutineCompletionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
