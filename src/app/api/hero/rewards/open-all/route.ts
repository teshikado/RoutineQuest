import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { openAllPendingRewards } from "@/lib/hero-service";

export async function POST() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const count = await openAllPendingRewards(userId);
  return NextResponse.json({ opened: count });
}
