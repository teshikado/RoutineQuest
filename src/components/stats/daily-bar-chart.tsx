"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CHART_BLUE = "#4FA8D8";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-[#183B56] text-white text-xs px-3 py-2 shadow-lg">
      <div className="font-semibold">{label}</div>
      <div>{payload[0].value} erledigt</div>
    </div>
  );
}

export function DailyBarChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#EAF7FC" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9db3c2" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9db3c2" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#EAF7FC" }} />
        <Bar dataKey="count" fill={CHART_BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
