import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RoutinesClient } from "@/components/routines/routines-client";

export default async function RoutinesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const routines = await prisma.routine.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return <RoutinesClient initialRoutines={routines} />;
}
