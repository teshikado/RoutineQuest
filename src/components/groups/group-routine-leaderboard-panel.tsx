"use client";

import { useEffect, useState } from "react";
import { Crown, Shield, Star } from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import type { GroupRoutineLeaderboardRow } from "@/lib/group-routine-leaderboard";

const MEDALS = [
  { icon: Crown, color: "#FFD166", bg: "#FFF6DF" },
  { icon: Shield, color: "#9db3c2", bg: "#F5F7FA" },
  { icon: Star, color: "#CD7F32", bg: "#FBEEE3" },
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
        <p className="text-sm text-[#5b7a91]">Lädt…</p>
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
                <div className="w-6 text-center font-bold text-[#5b7a91] shrink-0">
                  {medal ? <medal.icon className="h-5 w-5 mx-auto" style={{ color: medal.color }} /> : row.position}
                </div>
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: row.avatarColor + "33" }}
                >
                  {row.avatarEmoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#183B56] truncate">{row.username}</div>
                  <ProgressBar ratio={row.successRate ?? 0} colorClass="bg-[#78D6B0]" height="h-1.5" />
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[#183B56]">
                    {row.successRate !== null ? `${Math.round(row.successRate * 100)}%` : "–"}
                  </div>
                  <div className="text-[10px] text-[#5b7a91]">
                    🔥{row.currentStreak} · {row.routineXp} XP
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
