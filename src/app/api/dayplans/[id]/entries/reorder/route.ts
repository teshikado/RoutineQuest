import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { reorderEntries, DayPlanError } from "@/lib/dayplan-service";

const bodySchema = z.object({ entryIds: z.array(z.string().min(1)).min(1).max(500) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    await reorderEntries(userId, id, parsed.data.entryIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    throw err;
  }
}
