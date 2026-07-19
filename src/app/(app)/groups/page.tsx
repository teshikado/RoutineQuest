import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GroupsClient } from "@/components/groups/groups-client";

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    include: { group: { include: { _count: { select: { members: true } } } } },
    orderBy: { joinedAt: "asc" },
  });

  const groups = memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    description: m.group.description,
    icon: m.group.icon,
    color: m.group.color,
    memberCount: m.group._count.members,
    role: m.role,
    isPrivate: m.group.isPrivate,
  }));

  return <GroupsClient initialGroups={groups} />;
}
