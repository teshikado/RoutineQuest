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
      className="rounded-xl border border-[#dbeaf3] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#183B56] focus:outline-none focus:ring-2 focus:ring-[#4FA8D8]"
    >
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}
