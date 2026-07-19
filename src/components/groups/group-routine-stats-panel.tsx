"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RingChart } from "@/components/stats/ring-chart";
import { ActivityHeatmap } from "@/components/stats/activity-heatmap";
import type { GroupRoutineStats, GroupRoutinePeriod } from "@/lib/group-routine-stats";

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-[#183B56] text-white text-xs px-3 py-2 shadow-lg">
      <div className="font-semibold">{label}</div>
      <div>{payload[0].value} erledigt</div>
    </div>
  );
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-[#183B56] text-white text-xs px-3 py-2 shadow-lg">
      <div className="font-semibold">{label}</div>
      <div>{payload[0].value}% Erfolgsquote</div>
    </div>
  );
}

export function GroupRoutineStatsPanel({
  groupId,
  routineId,
  refreshKey,
}: {
  groupId: string;
  routineId: string;
  refreshKey?: number;
}) {
  const [period, setPeriod] = useState<GroupRoutinePeriod>("week");
  const [stats, setStats] = useState<GroupRoutineStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch-on-dependency-change data-loading pattern
    setLoading(true);
    fetch(`/api/groups/${groupId}/routines/${routineId}/stats?period=${period}`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, [groupId, routineId, period, refreshKey]);

  const periodLabel = period === "week" ? "Woche" : "Monat";

  return (
    <Card>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <CardTitle>Auswertung</CardTitle>
        <div className="flex gap-1.5">
          <button
            onClick={() => setPeriod("week")}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              period === "week" ? "bg-[#4FA8D8] text-white" : "bg-[#F5F7FA] text-[#5b7a91]"
            }`}
          >
            Woche
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              period === "month" ? "bg-[#4FA8D8] text-white" : "bg-[#F5F7FA] text-[#5b7a91]"
            }`}
          >
            Monat
          </button>
        </div>
      </div>
      <CardSubtitle className="mb-4">{stats?.rangeLabel ?? "…"}</CardSubtitle>

      {loading || !stats ? (
        <div className="space-y-4" role="status" aria-label="Auswertung wird geladen">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-44 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-[#F5F7FA] p-3 text-center">
              <div className="text-xl font-extrabold text-[#183B56]">{stats.participantCount}</div>
              <div className="text-xs text-[#5b7a91]">Teilnehmende</div>
            </div>
            <div className="rounded-xl bg-[#F5F7FA] p-3 text-center">
              <div className="text-xl font-extrabold text-[#183B56]">{stats.totalCompletions}</div>
              <div className="text-xs text-[#5b7a91]">Erledigungen ({periodLabel})</div>
            </div>
            <div className="rounded-xl bg-[#F5F7FA] p-3 text-center">
              <div className="text-xl font-extrabold text-[#183B56]">
                {stats.avgSuccessRate !== null ? `${Math.round(stats.avgSuccessRate * 100)}%` : "–"}
              </div>
              <div className="text-xs text-[#5b7a91]">Ø Erfolgsquote</div>
            </div>
            <div className="rounded-xl bg-[#F5F7FA] p-3 text-center">
              <div
                className="text-xl font-extrabold"
                style={{ color: (stats.groupImprovementPct ?? 0) >= 0 ? "#78D6B0" : "#FF8A80" }}
              >
                {stats.groupImprovementPct !== null
                  ? `${stats.groupImprovementPct > 0 ? "+" : ""}${stats.groupImprovementPct}%`
                  : "–"}
              </div>
              <div className="text-xs text-[#5b7a91]">Ggü. Vorwoche</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {stats.mostCompletions && (
              <div className="rounded-xl border border-[#EAF7FC] p-3">
                <div className="text-xs text-[#5b7a91]">Meiste Erledigungen</div>
                <div className="font-bold text-[#183B56]">
                  {stats.mostCompletions.username} · {stats.mostCompletions.completions}x
                </div>
              </div>
            )}
            {stats.highestRate && (
              <div className="rounded-xl border border-[#EAF7FC] p-3">
                <div className="text-xs text-[#5b7a91]">Höchste Erfolgsquote</div>
                <div className="font-bold text-[#183B56]">
                  {stats.highestRate.username} ·{" "}
                  {stats.highestRate.successRate !== null ? Math.round(stats.highestRate.successRate * 100) : 0}%
                </div>
              </div>
            )}
            {stats.longestStreakMember && (
              <div className="rounded-xl border border-[#EAF7FC] p-3">
                <div className="text-xs text-[#5b7a91]">Längste Erfolgsserie</div>
                <div className="font-bold text-[#183B56]">
                  {stats.longestStreakMember.username} · {stats.longestStreakMember.streak} Tage
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-semibold text-[#183B56] mb-2">Erledigte Tage pro Mitglied</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.members} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#EAF7FC" />
                  <XAxis
                    dataKey="username"
                    tick={{ fontSize: 11, fill: "#9db3c2" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#9db3c2" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: "#EAF7FC" }} />
                  <Bar dataKey="completions" fill="#4FA8D8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="text-sm font-semibold text-[#183B56] mb-2 self-start">Ø Gruppenleistung</div>
              <RingChart
                label="Erfolgsquote"
                ratio={stats.avgSuccessRate ?? 0}
                detail={`${stats.totalCompletions} Erledigungen in dieser ${periodLabel}`}
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-[#183B56] mb-2">Verlauf der Routine</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart
                data={stats.trend.map((t) => ({ label: t.label, rate: t.successRate !== null ? Math.round(t.successRate * 100) : 0 }))}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#EAF7FC" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9db3c2" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9db3c2" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#EAF7FC", strokeWidth: 2 }} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#78D6B0"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#78D6B0", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="text-sm font-semibold text-[#183B56] mb-2">Gruppenaktivität</div>
            <ActivityHeatmap data={stats.heatmap} />
          </div>
        </div>
      )}
    </Card>
  );
}
