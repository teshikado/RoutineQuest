import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership } from "@/lib/group-auth";
import { getGroupRoutineStats } from "@/lib/group-routine-stats";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; routineId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, routineId } = await params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "Kein Zugriff auf diese Gruppe." }, { status: 403 });

  const url = new URL(req.url);
  const period = url.searchParams.get("period") === "month" ? "month" : "week";

  const stats = await getGroupRoutineStats(routineId, period);
  return NextResponse.json(stats);
}
