import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { duplicateEntry, DayPlanError } from "@/lib/dayplan-service";

const bodySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültiges Datum." }, { status: 400 });
  }

  try {
    const result = await duplicateEntry(userId, id, parsed.data.date);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "ENTRY_NOT_FOUND" ? 404 : 400 });
    throw err;
  }
}
