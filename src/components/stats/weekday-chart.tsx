const BLUE = "#A855F7";
const MINT = "#34D399";

export function WeekdayChart({
  data,
  bestWeekday,
}: {
  data: { weekday: number; label: string; ratio: number | null }[];
  bestWeekday: number | null;
}) {
  return (
    <div className="flex items-end justify-between gap-2 h-40">
      {data.map((d) => {
        const pct = d.ratio ?? 0;
        const isBest = d.weekday === bestWeekday;
        return (
          <div key={d.weekday} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <span className="text-[10px] font-bold text-[#F8F7FC]">
              {d.ratio === null ? "–" : `${Math.round(pct * 100)}%`}
            </span>
            <div
              title={`${d.label}: ${d.ratio === null ? "keine Daten" : `${Math.round(pct * 100)}%`}`}
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${Math.max(4, pct * 100)}%`,
                backgroundColor: isBest ? MINT : BLUE,
                opacity: d.ratio === null ? 0.25 : 1,
              }}
            />
            <span className="text-[10px] text-[#8D8998] font-semibold">{d.label.slice(0, 2)}</span>
          </div>
        );
      })}
    </div>
  );
}
