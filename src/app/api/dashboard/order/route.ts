import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { dashboardOrderSaveSchema } from "@/lib/validation";
import { saveDashboardOrder, resetDashboardOrder } from "@/lib/dashboard-data";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = dashboardOrderSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  await saveDashboardOrder(userId, parsed.data.items);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  await resetDashboardOrder(userId);
  return NextResponse.json({ ok: true });
}
