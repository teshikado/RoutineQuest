import { NextResponse } from "next/server";
import { requireUserId, isErrorResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** Routines and group routines the current user could link a day-plan entry to, for the
 * "Routine verbinden" picker. Only active, currently-joined items -- never other users' data. */
export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const [routines, groupParticipations] = await Promise.all([
    prisma.routine.findMany({
      where: { userId, archived: false },
      select: { id: true, title: true, icon: true, color: true, scheduledDays: true },
      orderBy: { title: "asc" },
    }),
    prisma.groupRoutineParticipant.findMany({
      where: { userId, status: "JOINED", groupRoutine: { status: "ACTIVE" } },
      select: {
        groupRoutine: {
          select: { id: true, title: true, icon: true, color: true, scheduledDays: true, group: { select: { name: true } } },
        },
      },
    }),
  ]);

  return NextResponse.json({
    routines,
    groupRoutines: groupParticipations.map((p) => ({ ...p.groupRoutine, groupName: p.groupRoutine.group.name })),
  });
}
