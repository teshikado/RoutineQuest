"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CHART_BLUE = "#A855F7";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-[#1D1D28] text-white text-xs px-3 py-2 shadow-lg">
      <div className="font-semibold">{label}</div>
      <div>{payload[0].value} erledigt</div>
    </div>
  );
}

export function DailyBarChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="dailyBarFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_BLUE} stopOpacity={0.95} />
            <stop offset="100%" stopColor={CHART_BLUE} stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#292936" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8D8998" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#8D8998" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#292936" }} />
        <Bar dataKey="count" fill="url(#dailyBarFill)" radius={[6, 6, 0, 0]} maxBarSize={28} animationDuration={600} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  );
}
