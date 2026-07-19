import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getGroupRoutineList } from "@/lib/group-routine-data";
import { GroupRoutinesListClient } from "@/components/groups/group-routines-list-client";

export default async function GroupRoutinesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.user.id } },
  });
  if (!membership) notFound();

  const group = await prisma.group.findUnique({ where: { id }, select: { id: true, name: true, icon: true, color: true } });
  if (!group) notFound();

  const routines = await getGroupRoutineList(id, session.user.id);
  const isLeader = membership.role === "OWNER" || membership.role === "ADMIN";

  return <GroupRoutinesListClient group={group} routines={routines} isLeader={isLeader} />;
}
