import Link from "next/link";
import { ChevronLeft, ChevronRight, Check, Circle, X, Minus } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getWeekData, weekLabel, type DayStatus } from "@/lib/week-data";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { dateKey, todayDateOnly } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { DynamicIcon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_CONFIG: Record<DayStatus, { icon: React.ReactNode; className: string; label: string }> = {
  done: { icon: <Check className="h-4 w-4" />, className: "bg-[#78D6B0] text-white", label: "Erledigt" },
  open: { icon: <Circle className="h-3.5 w-3.5" />, className: "bg-white border-2 border-[#A7D8F0] text-[#A7D8F0]", label: "Offen" },
  missed: { icon: <X className="h-4 w-4" />, className: "bg-[#FFE0DC] text-[#e2564c]", label: "Verpasst" },
  not_scheduled: { icon: <Minus className="h-3.5 w-3.5" />, className: "bg-[#F5F7FA] text-[#c8d6e0]", label: "Nicht geplant" },
};

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { offset: offsetParam } = await searchParams;
  const offset = Number.parseInt(offsetParam ?? "0", 10) || 0;

  const { week, rows } = await getWeekData(session.user.id, offset);
  const todayKey = dateKey(todayDateOnly());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#183B56]">Wochenplan</h1>
          <p className="text-[#5b7a91] mt-1">{weekLabel(week)}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/week?offset=${offset - 1}`}
            className="h-10 w-10 rounded-xl bg-white border border-[#EAF7FC] flex items-center justify-center text-[#5b7a91] hover:text-[#4FA8D8] hover:bg-[#EAF7FC]"
            aria-label="Vorherige Woche"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Link
            href="/week"
            className="h-10 px-4 rounded-xl bg-white border border-[#EAF7FC] flex items-center justify-center text-sm font-semibold text-[#5b7a91] hover:text-[#4FA8D8] hover:bg-[#EAF7FC]"
          >
            Heute
          </Link>
          <Link
            href={`/week?offset=${offset + 1}`}
            className="h-10 w-10 rounded-xl bg-white border border-[#EAF7FC] flex items-center justify-center text-[#5b7a91] hover:text-[#4FA8D8] hover:bg-[#EAF7FC]"
            aria-label="Nächste Woche"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-[#5b7a91]">
        {(Object.entries(STATUS_CONFIG) as [DayStatus, (typeof STATUS_CONFIG)[DayStatus]][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`h-5 w-5 rounded-full flex items-center justify-center ${cfg.className}`}>
              {cfg.icon}
            </span>
            {cfg.label}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="CalendarDays"
          title="Keine Routinen in dieser Woche"
          description="Für diesen Zeitraum sind keine Routinen geplant."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-[#5b7a91] pb-3 pr-3 sticky left-0 bg-white">
                  Routine
                </th>
                {week.days.map((day, i) => (
                  <th
                    key={dateKey(day)}
                    className={`text-center text-xs font-semibold pb-3 px-1 ${
                      dateKey(day) === todayKey ? "text-[#4FA8D8]" : "text-[#5b7a91]"
                    }`}
                  >
                    {WEEKDAY_LABELS[i + 1]}
                    <div className="text-[10px] font-normal">{day.getUTCDate()}.</div>
                  </th>
                ))}
                <th className="text-center text-xs font-semibold text-[#5b7a91] pb-3 pl-3">Quote</th>
                <th className="text-center text-xs font-semibold text-[#5b7a91] pb-3 pl-3">XP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#F5F7FA]">
                  <td className="py-3 pr-3 sticky left-0 bg-white">
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <div
                        className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: row.color + "22" }}
                      >
                        <DynamicIcon name={row.icon} className="h-3.5 w-3.5" style={{ color: row.color }} />
                      </div>
                      <span className="text-sm font-semibold text-[#183B56] truncate">{row.title}</span>
                      {row.groupBadge && (
                        <span
                          className="flex items-center gap-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 shrink-0"
                          style={{ backgroundColor: row.groupBadge.color + "1a", color: row.groupBadge.color }}
                        >
                          <DynamicIcon name={row.groupBadge.icon} className="h-2.5 w-2.5" />
                          {row.groupBadge.name}
                        </span>
                      )}
                    </div>
                  </td>
                  {row.days.map((status, i) => {
                    const cfg = STATUS_CONFIG[status];
                    return (
                      <td key={i} className="text-center px-1">
                        <span
                          title={cfg.label}
                          className={`inline-flex h-7 w-7 rounded-full items-center justify-center ${cfg.className}`}
                        >
                          {cfg.icon}
                        </span>
                      </td>
                    );
                  })}
                  <td className="text-center pl-3 text-sm font-bold text-[#183B56]">
                    {row.successRate === null ? "–" : `${Math.round(row.successRate * 100)}%`}
                  </td>
                  <td className="text-center pl-3 text-sm font-bold text-[#FFD166]">{row.xpCollected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
