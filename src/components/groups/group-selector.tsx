"use client";

import { useRouter } from "next/navigation";

export function GroupSelector({
  groups,
  selectedId,
}: {
  groups: { id: string; name: string }[];
  selectedId: string;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedId}
      onChange={(e) => router.push(`/leaderboard?group=${e.target.value}`)}
      className="rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm font-semibold text-[#F8F7FC] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
    >
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}
