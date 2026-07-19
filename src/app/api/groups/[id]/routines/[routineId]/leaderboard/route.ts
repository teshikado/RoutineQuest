import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { getMembership } from "@/lib/group-auth";
import { getGroupRoutineLeaderboard } from "@/lib/group-routine-leaderboard";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; routineId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id, routineId } = await params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "Kein Zugriff auf diese Gruppe." }, { status: 403 });

  const rows = await getGroupRoutineLeaderboard(routineId);
  return NextResponse.json({ members: rows });
}
