"use client";

import { useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/constants";

const MINT_RAMP = ["#F5F7FA", "#D3F0E3", "#A2E0C3", "#6BC99C", "#3FAE7F", "#237355"];

function levelFor(count: number, scheduled: number): number {
  if (scheduled === 0) return 0;
  const ratio = count / scheduled;
  if (ratio === 0) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 1) return 3;
  if (ratio === 1) return 4;
  return 5;
}

export function ActivityHeatmap({ data }: { data: { date: string; count: number; scheduled: number }[] }) {
  const [hovered, setHovered] = useState<{ date: string; count: number; scheduled: number } | null>(null);

  const weeks: typeof data[number][][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        <div className="flex flex-col gap-1 pr-1 shrink-0">
          {Object.values(WEEKDAY_LABELS).map((label, i) => (
            <div key={i} className="h-3.5 w-6 text-[9px] text-[#9db3c2] flex items-center">
              {i % 2 === 0 ? label : ""}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 shrink-0">
            {week.map((day) => (
              <div
                key={day.date}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered(null)}
                className="h-3.5 w-3.5 rounded-sm cursor-pointer transition-transform hover:scale-125"
                style={{ backgroundColor: MINT_RAMP[levelFor(day.count, day.scheduled)] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
        <div className="h-6 text-xs text-[#5b7a91]">
          {hovered
            ? `${hovered.date}: ${hovered.count} von ${hovered.scheduled} Aufgaben erledigt`
            : "Fahre über ein Feld für Details"}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[#9db3c2]">
          Weniger
          {MINT_RAMP.map((color, i) => (
            <span key={i} className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
          ))}
          Mehr
        </div>
      </div>
    </div>
  );
}
