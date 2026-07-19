"use client";

import { useEffect, useState } from "react";
import { Crown, Shield, Star } from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { GroupRoutineLeaderboardRow } from "@/lib/group-routine-leaderboard";

const MEDALS = [
  { icon: Crown, color: "#FACC15", bg: "#2A2107" },
  { icon: Shield, color: "#C0C0CE", bg: "#171720" },
  { icon: Star, color: "#CD7F32", bg: "#2A1B10" },
];

export function GroupRoutineLeaderboardPanel({
  groupId,
  routineId,
  refreshKey,
}: {
  groupId: string;
  routineId: string;
  refreshKey?: number;
}) {
  const [rows, setRows] = useState<GroupRoutineLeaderboardRow[] | null>(null);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/routines/${routineId}/leaderboard`)
      .then((res) => res.json())
      .then((data) => setRows(data.members));
  }, [groupId, routineId, refreshKey]);

  return (
    <Card>
      <CardTitle>Rangliste</CardTitle>
      <CardSubtitle className="mb-4">Wer zieht die Gruppenroutine am konsequentesten durch?</CardSubtitle>

      {!rows ? (
        <div className="space-y-2" role="status" aria-label="Rangliste wird geladen">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl p-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-1.5 w-full" />
              </div>
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon="Trophy" title="Noch keine Rangliste" description="Sobald Mitglieder teilnehmen und abhaken, erscheint hier die Rangliste." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const medal = row.position <= 3 ? MEDALS[row.position - 1] : null;
            return (
              <li
                key={row.userId}
                className="flex items-center gap-3 rounded-xl p-3"
                style={{ backgroundColor: medal ? medal.bg : "transparent" }}
              >
                <div className="w-6 text-center font-bold text-[#C8C5D2] shrink-0">
                  {medal ? <medal.icon className="h-5 w-5 mx-auto" style={{ color: medal.color }} /> : row.position}
                </div>
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: row.avatarColor + "33" }}
                >
                  {row.avatarEmoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#F8F7FC] truncate">{row.username}</div>
                  <ProgressBar ratio={row.successRate ?? 0} colorClass="bg-[#34D399]" height="h-1.5" />
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[#F8F7FC]">
                    {row.successRate !== null ? `${Math.round(row.successRate * 100)}%` : "–"}
                  </div>
                  <div className="text-[10px] text-[#C8C5D2]">
                    {row.completedDays} Tage · {row.routineXp} XP
                  </div>
                  <div className="text-[10px] text-[#C8C5D2]">
                    🔥{row.currentStreak} · Rekord {row.longestStreak}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
