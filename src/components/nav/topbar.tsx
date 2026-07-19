import Image from "next/image";
import type { User } from "@prisma/client";
import { getLevelProgress, getRankForLevel } from "@/lib/xp";
import { RankBadge } from "@/components/ui/rank-badge";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Flame } from "lucide-react";

export function Topbar({ user }: { user: User }) {
  const progress = getLevelProgress(user.totalXp);
  const rank = getRankForLevel(progress.level);

  return (
    <header className="h-16 shrink-0 flex items-center gap-3 px-4 md:px-8 glass-surface border-b border-[#292936] sticky top-0 z-30">
      <div className="md:hidden flex items-center gap-2">
        <Image
          src="/logo/logo-mark-sm.png"
          alt="RoutineQuest"
          width={28}
          height={21}
          style={{ filter: "drop-shadow(0 0 6px rgba(168,85,247,0.5))" }}
          priority
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div
          className="hidden sm:flex items-center gap-2 rounded-full bg-[#171720] pl-1.5 pr-3 py-1 text-xs font-bold text-[#F8F7FC]"
          title={rank.name}
        >
          <RankBadge icon={rank.icon} color={rank.color} size="xs" />
          Level {progress.level}
        </div>

        {user.currentStreak > 0 && (
          <div className="hidden sm:flex items-center gap-1 rounded-full bg-[#2A2107] px-3 py-1.5 text-xs font-bold text-[#FBBF24]">
            <Flame className="h-3.5 w-3.5 text-[#FACC15] animate-flame" />
            {user.currentStreak}
          </div>
        )}

        <NotificationBell />

        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: user.avatarColor + "33" }}
        >
          {user.avatarEmoji}
        </div>
      </div>
    </header>
  );
}
