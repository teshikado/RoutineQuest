import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "@/components/profile/profile-client";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, badges] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.userBadge.findMany({
      where: { userId: session.user.id },
      include: { badge: true },
      orderBy: { earnedAt: "desc" },
    }),
  ]);

  return (
    <ProfileClient
      user={{
        email: user.email,
        username: user.username ?? "",
        avatarEmoji: user.avatarEmoji,
        avatarColor: user.avatarColor,
        totalXp: user.totalXp,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
      }}
      badges={badges.map((b) => ({
        id: b.id,
        name: b.badge.name,
        description: b.badge.description,
        icon: b.badge.icon,
        color: b.badge.color,
        earnedAt: b.earnedAt.toISOString(),
      }))}
    />
  );
}
