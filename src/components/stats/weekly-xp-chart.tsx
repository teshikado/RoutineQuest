"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="weeklyXpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_GOLD} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#EAF7FC" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9db3c2" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9db3c2" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#EAF7FC", strokeWidth: 2 }} />
        <Area
          type="monotone"
          dataKey="xp"
          stroke={CHART_GOLD}
          strokeWidth={2.5}
          fill="url(#weeklyXpFill)"
          dot={{ r: 4, fill: CHART_GOLD, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
          animationDuration={700}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
