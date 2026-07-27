import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { setEntryStatus, DayPlanError } from "@/lib/dayplan-service";

const bodySchema = z.object({ status: z.enum(["PLANNED", "IN_PROGRESS", "SKIPPED"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
  }

  try {
    const entry = await setEntryStatus(userId, id, parsed.data.status);
    return NextResponse.json(entry);
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
