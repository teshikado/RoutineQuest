"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CHART_GOLD = "#D69E22";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-[#183B56] text-white text-xs px-3 py-2 shadow-lg">
      <div className="font-semibold">Woche {label}</div>
      <div>{payload[0].value} XP</div>
    </div>
  );
}

export function WeeklyXpChart({ data }: { data: { label: string; xp: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#EAF7FC" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9db3c2" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9db3c2" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#EAF7FC", strokeWidth: 2 }} />
        <Line
          type="monotone"
          dataKey="xp"
          stroke={CHART_GOLD}
          strokeWidth={2}
          dot={{ r: 4, fill: CHART_GOLD, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
