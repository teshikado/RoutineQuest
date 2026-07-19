"use client";

import { useState } from "react";

const MINT = "#3FAE7F";
const TRACK = "#EAF7FC";

export function RingChart({
  label,
  ratio,
  detail,
}: {
  label: string;
  ratio: number;
  detail: string;
}) {
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
          <circle cx={size / 2} cy={size / 2} r={radius} stroke={TRACK} strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={MINT}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-xl font-extrabold text-[#183B56]">{Math.round(pct * 100)}%</span>
        </div>
        {hover && (
          <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#183B56] text-white text-xs px-2.5 py-1.5 shadow-lg z-10">
            {detail}
          </div>
        )}
      </div>
      <span className="text-sm font-semibold text-[#5b7a91]">{label}</span>
    </div>
  );
}
