import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { openRewardClaim, HeroError } from "@/lib/hero-service";

export async function POST(_req: Request, { params }: { params: Promise<{ claimId: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { claimId } = await params;

  try {
    const claim = await openRewardClaim(userId, claimId);
    return NextResponse.json({ claim });
  } catch (err) {
    if (err instanceof HeroError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    throw err;
  }
}
