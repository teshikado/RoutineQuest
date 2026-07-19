import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { toggleCompletion, CompletionError } from "@/lib/completion-service";
import { parseDateKey } from "@/lib/dates";

const bodySchema = z.object({
  routineId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const result = await toggleCompletion(userId, parsed.data.routineId, parseDateKey(parsed.data.date));
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CompletionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Unerwarteter Fehler." }, { status: 500 });
  }
}
