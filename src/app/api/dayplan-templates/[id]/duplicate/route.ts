import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { duplicateTemplate, DayPlanError } from "@/lib/dayplan-service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;
  const { id } = await params;
  try {
    const template = await duplicateTemplate(userId, id);
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    if (err instanceof DayPlanError) return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    throw err;
  }
}
