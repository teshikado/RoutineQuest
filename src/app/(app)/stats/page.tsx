import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Flame, TrendingUp, TrendingDown, Award, AlertTriangle } from "lucide-react";
import { getStatsData } from "@/lib/stats-data";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/card";
import { DynamicIcon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal, RevealGroup } from "@/components/ui/reveal";
import { DailyBarChart } from "@/components/stats/daily-bar-chart";
import { WeeklyXpChart } from "@/components/stats/weekly-xp-chart";
import { RingChart } from "@/components/stats/ring-chart";
import { ActivityHeatmap } from "@/components/stats/activity-heatmap";
import { WeekdayChart } from "@/components/stats/weekday-chart";

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const stats = await getStatsData(session.user.id);

  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="text-2xl font-extrabold text-[#183B56]">Statistiken</h1>
        <p className="text-[#5b7a91] mt-1">Dein Fortschritt im Überblick.</p>
      </Reveal>

      <RevealGroup className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.05}>
        <Card className="flex items-center gap-3">
          <Flame className="h-8 w-8 text-[#FFD166] shrink-0" />
          <div>
            <div className="text-xl font-extrabold text-[#183B56] tabular-nums">{stats.currentStreak}</div>
            <div className="text-xs text-[#5b7a91]">Aktuelle Streak</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Award className="h-8 w-8 text-[#4FA8D8] shrink-0" />
          <div>
            <div className="text-xl font-extrabold text-[#183B56] tabular-nums">{stats.longestStreak}</div>
            <div className="text-xs text-[#5b7a91]">Längste Erfolgsserie</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <DynamicIcon name="Sparkles" className="h-8 w-8 text-[#D69E22] shrink-0" />
          <div>
            <div className="text-xl font-extrabold text-[#183B56] tabular-nums">{stats.thisWeekXp}</div>
            <div className="text-xs text-[#5b7a91]">XP diese Woche</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          {stats.xpChangePct !== null && stats.xpChangePct >= 0 ? (
            <TrendingUp className="h-8 w-8 text-[#3FAE7F] shrink-0" />
          ) : (
            <TrendingDown className="h-8 w-8 text-[#E2564C] shrink-0" />
          )}
          <div>
            <div className="text-xl font-extrabold text-[#183B56] tabular-nums">
              {stats.xpChangePct === null ? "–" : `${stats.xpChangePct > 0 ? "+" : ""}${stats.xpChangePct}%`}
            </div>
            <div className="text-xs text-[#5b7a91]">Vs. letzte Woche</div>
          </div>
        </Card>
      </RevealGroup>

      <RevealGroup className="grid grid-cols-1 lg:grid-cols-2 gap-4" stagger={0.08}>
        <Card>
          <CardTitle>Erledigte Aufgaben pro Tag</CardTitle>
          <CardSubtitle className="mb-2">Letzte 14 Tage</CardSubtitle>
          <DailyBarChart data={stats.dailyCompletions} />
        </Card>
        <Card>
          <CardTitle>Gesammelte XP pro Woche</CardTitle>
          <CardSubtitle className="mb-2">Letzte 8 Wochen</CardSubtitle>
          <WeeklyXpChart data={stats.weeklyXp} />
        </Card>
      </RevealGroup>

      <RevealGroup className="grid grid-cols-1 lg:grid-cols-3 gap-4" stagger={0.08}>
        <Card className="flex flex-col items-center justify-center gap-4 lg:col-span-1">
          <CardTitle className="self-start">Erfolgsquote</CardTitle>
          <div className="flex gap-6">
            <RingChart
              label="Diese Woche"
              ratio={stats.weekSuccessRatio}
              detail={`${Math.round(stats.weekSuccessRatio * 100)}% der geplanten Aufgaben erledigt`}
            />
            <RingChart
              label="Dieser Monat"
              ratio={stats.monthSuccessRatio}
              detail={`${Math.round(stats.monthSuccessRatio * 100)}% der geplanten Aufgaben erledigt`}
            />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Erfolgreichster Wochentag</CardTitle>
          <CardSubtitle className="mb-3">
            {stats.bestWeekday
              ? `${stats.bestWeekday.label} läuft bei dir am besten (${Math.round((stats.bestWeekday.ratio ?? 0) * 100)}%).`
              : "Noch nicht genug Daten."}
          </CardSubtitle>
          <WeekdayChart data={stats.weekdaySuccess} bestWeekday={stats.bestWeekday?.weekday ?? null} />
        </Card>
      </RevealGroup>

      <Reveal>
        <Card>
          <CardTitle>Aktivitäts-Heatmap</CardTitle>
          <CardSubtitle className="mb-3">Letzte 12 Wochen</CardSubtitle>
          <ActivityHeatmap data={stats.heatmap} />
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#E2564C]" /> Häufig ausgelassene Routinen
          </CardTitle>
          <CardSubtitle className="mb-3">Letzte 90 Tage</CardSubtitle>
          {stats.frequentlySkipped.length === 0 ? (
            <EmptyState
              icon="ThumbsUp"
              title="Alles im grünen Bereich"
              description="Aktuell gibt es keine auffällig oft ausgelassenen Routinen."
            />
          ) : (
            <ul className="space-y-2">
              {stats.frequentlySkipped.map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: r.color + "22" }}
                  >
                    <DynamicIcon name={r.icon} className="h-4 w-4" style={{ color: r.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#183B56] truncate">{r.title}</div>
                    <div className="text-xs text-[#5b7a91]">
                      {r.missed} von {r.scheduled} verpasst
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#E2564C] tabular-nums">{Math.round(r.missRate * 100)}%</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
