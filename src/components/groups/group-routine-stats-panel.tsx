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
    <div className="rounded-lg bg-[#1D1D28] text-white text-xs px-3 py-2 shadow-lg">
      <div className="font-semibold">{label}</div>
      <div>{payload[0].value} erledigt</div>
    </div>
  );
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-[#1D1D28] text-white text-xs px-3 py-2 shadow-lg">
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
              period === "week" ? "bg-[#A855F7] text-white" : "bg-[#171720] text-[#C8C5D2]"
            }`}
          >
            Woche
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              period === "month" ? "bg-[#A855F7] text-white" : "bg-[#171720] text-[#C8C5D2]"
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
            <div className="rounded-xl bg-[#171720] p-3 text-center">
              <div className="text-xl font-extrabold text-[#F8F7FC]">{stats.participantCount}</div>
              <div className="text-xs text-[#C8C5D2]">Teilnehmende</div>
            </div>
            <div className="rounded-xl bg-[#171720] p-3 text-center">
              <div className="text-xl font-extrabold text-[#F8F7FC]">{stats.totalCompletions}</div>
              <div className="text-xs text-[#C8C5D2]">Erledigungen ({periodLabel})</div>
            </div>
            <div className="rounded-xl bg-[#171720] p-3 text-center">
              <div className="text-xl font-extrabold text-[#F8F7FC]">
                {stats.avgSuccessRate !== null ? `${Math.round(stats.avgSuccessRate * 100)}%` : "–"}
              </div>
              <div className="text-xs text-[#C8C5D2]">Ø Erfolgsquote</div>
            </div>
            <div className="rounded-xl bg-[#171720] p-3 text-center">
              <div
                className="text-xl font-extrabold"
                style={{ color: (stats.groupImprovementPct ?? 0) >= 0 ? "#34D399" : "#FB7185" }}
              >
                {stats.groupImprovementPct !== null
                  ? `${stats.groupImprovementPct > 0 ? "+" : ""}${stats.groupImprovementPct}%`
                  : "–"}
              </div>
              <div className="text-xs text-[#C8C5D2]">Ggü. Vorwoche</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {stats.mostCompletions && (
              <div className="rounded-xl border border-[#292936] p-3">
                <div className="text-xs text-[#C8C5D2]">Meiste Erledigungen</div>
                <div className="font-bold text-[#F8F7FC]">
                  {stats.mostCompletions.username} · {stats.mostCompletions.completions}x
                </div>
              </div>
            )}
            {stats.highestRate && (
              <div className="rounded-xl border border-[#292936] p-3">
                <div className="text-xs text-[#C8C5D2]">Höchste Erfolgsquote</div>
                <div className="font-bold text-[#F8F7FC]">
                  {stats.highestRate.username} ·{" "}
                  {stats.highestRate.successRate !== null ? Math.round(stats.highestRate.successRate * 100) : 0}%
                </div>
              </div>
            )}
            {stats.longestStreakMember && (
              <div className="rounded-xl border border-[#292936] p-3">
                <div className="text-xs text-[#C8C5D2]">Längste Erfolgsserie</div>
                <div className="font-bold text-[#F8F7FC]">
                  {stats.longestStreakMember.username} · {stats.longestStreakMember.streak} Tage
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-semibold text-[#F8F7FC] mb-2">Erledigte Tage pro Mitglied</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.members} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#292936" />
                  <XAxis
                    dataKey="username"
                    tick={{ fontSize: 11, fill: "#8D8998" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#8D8998" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: "#292936" }} />
                  <Bar dataKey="completions" fill="#A855F7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="text-sm font-semibold text-[#F8F7FC] mb-2 self-start">Ø Gruppenleistung</div>
              <RingChart
                label="Erfolgsquote"
                ratio={stats.avgSuccessRate ?? 0}
                detail={`${stats.totalCompletions} Erledigungen in dieser ${periodLabel}`}
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-[#F8F7FC] mb-2">Verlauf der Routine</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart
                data={stats.trend.map((t) => ({ label: t.label, rate: t.successRate !== null ? Math.round(t.successRate * 100) : 0 }))}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#292936" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8D8998" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8D8998" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#292936", strokeWidth: 2 }} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#34D399"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#34D399", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="text-sm font-semibold text-[#F8F7FC] mb-2">Gruppenaktivität</div>
            <ActivityHeatmap data={stats.heatmap} />
          </div>
        </div>
      )}
    </Card>
  );
}
