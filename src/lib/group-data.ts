import { prisma } from "./prisma";
import { getLevelProgress, getRankForLevel } from "./xp";

export async function getGroupDetail(groupId: string, userId: string) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) return null;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: true }, orderBy: { joinedAt: "asc" } },
      invites: { where: { revoked: false }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!group) return null;

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    icon: group.icon,
    color: group.color,
    ownerId: group.ownerId,
    maxMembers: group.maxMembers,
    isPrivate: group.isPrivate,
    myRole: membership.role,
    myUserId: userId,
    activeInviteCode: group.invites[0]?.code ?? null,
    members: group.members.map((m) => {
      const progress = getLevelProgress(m.user.totalXp);
      const rank = getRankForLevel(progress.level);
      return {
        userId: m.userId,
        username: m.user.username,
        avatarEmoji: m.user.avatarEmoji,
        avatarColor: m.user.avatarColor,
        role: m.role,
        level: progress.level,
        rankName: rank.name,
        rankIcon: rank.icon,
        rankColor: rank.color,
        currentStreak: m.user.currentStreak,
        joinedAt: m.joinedAt.toISOString(),
      };
    }),
  };
}

export type GroupDetail = NonNullable<Awaited<ReturnType<typeof getGroupDetail>>>;
