import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy, Medal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getGroupLeaderboard } from "@/lib/leaderboard-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DynamicIcon } from "@/components/ui/icon";
import { GroupSelector } from "@/components/groups/group-selector";

const MEDAL_COLORS = ["#FFD166", "#c8d6e0", "#d99a5b"];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: true },
    orderBy: { joinedAt: "asc" },
  });

  if (memberships.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-[#183B56]">Rangliste</h1>
        <EmptyState
          icon="Trophy"
          title="Noch in keiner Gruppe"
          description="Tritt einer Gruppe bei oder erstelle deine eigene, um an einer Rangliste teilzunehmen."
          action={
            <Link href="/groups">
              <Button size="sm">Zu den Gruppen</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const { group: groupIdParam } = await searchParams;
  const selectedGroupId = memberships.some((m) => m.groupId === groupIdParam)
    ? groupIdParam!
    : memberships[0].groupId;

  const data = await getGroupLeaderboard(selectedGroupId, userId);
  const selectedGroup = memberships.find((m) => m.groupId === selectedGroupId)!.group;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-extrabold text-[#183B56]">Rangliste</h1>
        <GroupSelector
          groups={memberships.map((m) => ({ id: m.group.id, name: m.group.name }))}
          selectedId={selectedGroupId}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-[#FFD166] shrink-0" />
          <div>
            <div className="text-lg font-extrabold text-[#183B56]">{data.groupTasksCompleted}</div>
            <div className="text-xs text-[#5b7a91]">Aufgaben diese Woche als Gruppe</div>
          </div>
        </Card>
        {data.me && (
          <Card className="flex items-center gap-3">
            <div className="text-lg font-extrabold text-[#3FAE7F]">
              {data.me.improvementPct >= 0 ? "+" : ""}
              {data.me.improvementPct}%
            </div>
            <div className="text-xs text-[#5b7a91]">Deine Verbesserung ggü. letzter Woche</div>
          </Card>
        )}
        {data.xpToNextPlace !== null && data.xpToNextPlace > 0 && (
          <Card className="flex items-center gap-3">
            <div className="text-lg font-extrabold text-[#4FA8D8]">{data.xpToNextPlace} XP</div>
            <div className="text-xs text-[#5b7a91]">Bis zum nächsten Platz</div>
          </Card>
        )}
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <DynamicIcon name={selectedGroup.icon} className="h-5 w-5" style={{ color: selectedGroup.color }} />
          <span className="font-bold text-[#183B56]">{selectedGroup.name}</span>
          <span className="text-xs text-[#9db3c2]">· Woche {data.week}</span>
        </div>

        <div className="space-y-2">
          {data.members.map((m) => (
            <div
              key={m.userId}
              className={`flex items-center gap-3 rounded-xl p-3 ${
                m.userId === userId ? "bg-[#EAF7FC]" : "bg-[#F5F7FA]"
              }`}
            >
              <div className="w-7 flex justify-center">
                {m.position <= 3 ? (
                  <Medal className="h-5 w-5" style={{ color: MEDAL_COLORS[m.position - 1] }} />
                ) : (
                  <span className="text-sm font-bold text-[#9db3c2]">{m.position}</span>
                )}
              </div>
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: m.avatarColor + "33" }}
              >
                {m.avatarEmoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#183B56] truncate">{m.username}</div>
                <div className="text-xs text-[#5b7a91] flex items-center gap-1">
                  <DynamicIcon name={m.rankIcon} className="h-3 w-3" style={{ color: m.rankColor }} />
                  Level {m.level} · {m.tasksCompleted} Aufgaben ·{" "}
                  {m.successRate === null ? "–" : `${Math.round(m.successRate * 100)}%`} Quote
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-extrabold text-[#183B56]">{m.weeklyXp} XP</div>
                <div className="text-[10px] text-[#9db3c2]">🔥 {m.currentStreak}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-xs text-[#9db3c2] text-center">
        Aus Datenschutzgründen werden nur Fortschrittswerte geteilt – Namen und Details deiner Routinen bleiben privat.
      </p>
    </div>
  );
}
