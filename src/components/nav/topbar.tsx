import type { User } from "@prisma/client";
import { getLevelProgress, getRankForLevel } from "@/lib/xp";
import { DynamicIcon } from "@/components/ui/icon";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Flame } from "lucide-react";

export function Topbar({ user }: { user: User }) {
  const progress = getLevelProgress(user.totalXp);
  const rank = getRankForLevel(progress.level);

  return (
    <header className="h-16 shrink-0 flex items-center gap-3 px-4 md:px-8 bg-white/70 backdrop-blur border-b border-[#EAF7FC] sticky top-0 z-30">
      <div className="md:hidden flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-[#4FA8D8] flex items-center justify-center">
          <span className="text-white text-xs font-bold">RQ</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div
          className="hidden sm:flex items-center gap-1.5 rounded-full bg-[#EAF7FC] px-3 py-1.5 text-xs font-bold text-[#183B56]"
          title={rank.name}
        >
          <DynamicIcon name={rank.icon} className="h-3.5 w-3.5" style={{ color: rank.color }} />
          Level {progress.level}
        </div>

        {user.currentStreak > 0 && (
          <div className="hidden sm:flex items-center gap-1 rounded-full bg-[#FFF3D6] px-3 py-1.5 text-xs font-bold text-[#a8730a]">
            <Flame className="h-3.5 w-3.5 text-[#FFD166] animate-flame" />
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
