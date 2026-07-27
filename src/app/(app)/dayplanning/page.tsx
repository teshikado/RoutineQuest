import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DayPlanningClient } from "@/components/dayplanning/dayplanning-client";

export default async function DayPlanningPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { xpForDayPlanning: true } });

  return <DayPlanningClient xpForDayPlanning={user.xpForDayPlanning} />;
}
