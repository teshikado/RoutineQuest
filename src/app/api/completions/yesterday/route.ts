import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { completeYesterdayRoutine, CompletionError } from "@/lib/completion-service";

const bodySchema = z.object({ routineId: z.string().min(1) });

// Deliberately no `date` field -- unlike /api/completions, this endpoint never accepts a
// client-supplied date. "Yesterday" is always computed server-side (see getYesterdayDate),
// so there is no date value here to validate or that could be manipulated into vorgestern.
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  try {
    const result = await completeYesterdayRoutine(userId, parsed.data.routineId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CompletionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    // Concurrent duplicate insert on the (routineId, date) unique constraint -- two racing
    // requests both passed completeYesterdayRoutine's own existence pre-check before either
    // committed. Surface it as the same clean "already completed" response instead of a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Diese Routine wurde für gestern bereits erledigt.", code: "ALREADY_COMPLETED_YESTERDAY" },
        { status: 400 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Unerwarteter Fehler." }, { status: 500 });
  }
}
