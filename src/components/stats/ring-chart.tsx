"use client";

import { useId, useState } from "react";

const MINT_FROM = "#10B981";
const MINT_TO = "#34D399";
const TRACK = "#292936";

export function RingChart({
  label,
  ratio,
  detail,
}: {
  label: string;
  ratio: number;
  detail: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState(false);
  const size = 120;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, ratio));
  const offset = circumference * (1 - pct);

  return (
    <div
      className="flex flex-col items-center gap-2"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={MINT_FROM} />
              <stop offset="100%" stopColor={MINT_TO} />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={radius} stroke={TRACK} strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.7s var(--ease-out-soft)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-xl font-extrabold text-[#F8F7FC] tabular-nums">{Math.round(pct * 100)}%</span>
        </div>
        {hover && (
          <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#1D1D28] text-white text-xs px-2.5 py-1.5 shadow-[var(--shadow-md)] z-10">
            {detail}
          </div>
        )}
      </div>
      <span className="text-sm font-semibold text-[#C8C5D2]">{label}</span>
    </div>
  );
}
