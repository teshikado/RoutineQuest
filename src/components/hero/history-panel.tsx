"use client";

import { Card } from "@/components/ui/card";
import { EQUIPMENT_SLOT_META, RARITY_META } from "@/lib/hero-constants";
import type { HeroRewardClaim } from "./hero-types";

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function HistoryPanel({ claims }: { claims: HeroRewardClaim[] }) {
  const sorted = [...claims].sort((a, b) => b.level - a.level);

  return (
    <Card>
      <h2 className="font-bold text-[#F8F7FC] mb-3">Belohnungsverlauf</h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-[#8D8998]">Noch keine Belohnungen erhalten.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-[#5F5B68]">
                <th className="px-1 py-2">Level</th>
                <th className="px-1 py-2">Datum</th>
                <th className="px-1 py-2">Gegenstand</th>
                <th className="px-1 py-2">Seltenheit</th>
                <th className="px-1 py-2">Stärke</th>
                <th className="px-1 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-t border-[#292936]">
                  <td className="px-1 py-2 font-semibold text-[#F8F7FC] tabular-nums">
                    {c.level}
                    {c.isMilestone && <span className="ml-1.5 text-[10px] font-bold text-[#FACC15]">Meilenstein</span>}
                  </td>
                  <td className="px-1 py-2 text-[#C8C5D2] tabular-nums">{formatDate(c.createdAt)}</td>
                  <td className="px-1 py-2 text-[#F8F7FC]">
                    {c.openedAt ? c.item.name : <span className="text-[#5F5B68] italic">Noch nicht geöffnet</span>}
                  </td>
                  <td className="px-1 py-2">
                    <span className="text-xs font-semibold" style={{ color: RARITY_META[c.item.rarity].color }}>
                      {RARITY_META[c.item.rarity].label}
                    </span>
                  </td>
                  <td className="px-1 py-2 text-[#C8C5D2] tabular-nums">{c.openedAt ? c.item.strength : "–"}</td>
                  <td className="px-1 py-2 text-xs text-[#C8C5D2]">
                    {!c.openedAt ? "Ungeöffnet" : c.item.isEquipped ? "Ausgerüstet" : `Inventar (${EQUIPMENT_SLOT_META[c.item.slot].label})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
