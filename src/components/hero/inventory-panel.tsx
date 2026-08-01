"use client";

import { useMemo, useState } from "react";
import type { EquipmentSlot, ItemRarity } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EQUIPMENT_SLOT_META, EQUIPMENT_SLOT_ORDER, RARITY_META, RARITY_ORDER, WEAPON_TYPE_META } from "@/lib/hero-constants";
import { EquipmentSprite } from "./equipment-sprite";
import type { HeroEquipmentItem } from "./hero-types";
import { Star } from "lucide-react";

type SlotFilter = "ALL" | EquipmentSlot;
type SortKey = "strength-desc" | "strength-asc" | "newest" | "rarity" | "name";

function itemStats(item: HeroEquipmentItem) {
  const stats: { label: string; value: number }[] = [];
  if (item.attack > 0) stats.push({ label: "Angriff", value: item.attack });
  if (item.defense > 0) stats.push({ label: "Verteidigung", value: item.defense });
  if (item.health > 0) stats.push({ label: "Leben", value: item.health });
  if (item.speed > 0) stats.push({ label: "Geschwindigkeit", value: item.speed });
  if (item.criticalChance > 0) stats.push({ label: "Krit.-Chance", value: item.criticalChance });
  return stats;
}

function ItemCard({
  item,
  onSelect,
  selected,
}: {
  item: HeroEquipmentItem;
  onSelect: () => void;
  selected: boolean;
}) {
  const meta = RARITY_META[item.rarity];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left rounded-2xl border bg-[#111118] p-3 transition-all ${selected ? "ring-2 ring-[#A855F7]" : ""}`}
      style={{ borderColor: selected ? meta.color : "#292936", boxShadow: item.rarity !== "COMMON" ? meta.glow : undefined }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
          {meta.label}
        </span>
        <div className="flex items-center gap-1">
          {item.isFavorite && <Star className="h-3 w-3 fill-[#FACC15] text-[#FACC15]" />}
          {item.isEquipped && <span className="text-[10px] font-bold text-[#34D399]">Angelegt</span>}
        </div>
      </div>
      <EquipmentSprite slot={item.slot} weaponType={item.weaponType} rarity={item.rarity} className="w-full h-16 mb-2" title={item.name} />
      <div className="text-xs font-semibold text-[#F8F7FC] truncate">{item.name}</div>
      <div className="text-[11px] text-[#8D8998]">
        {EQUIPMENT_SLOT_META[item.slot].label}
        {item.weaponType ? ` · ${WEAPON_TYPE_META[item.weaponType].label}` : ""} · Level {item.rewardLevel}
      </div>
      <div className="text-sm font-bold text-[#F8F7FC] mt-1 tabular-nums">Stärke {item.strength}</div>
    </button>
  );
}

export function InventoryPanel({
  items,
  onEquip,
  onUnequip,
  onFavorite,
}: {
  items: HeroEquipmentItem[];
  onEquip: (itemId: string) => Promise<void>;
  onUnequip: (itemId: string) => Promise<void>;
  onFavorite: (itemId: string) => Promise<void>;
}) {
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("ALL");
  const [rarityFilter, setRarityFilter] = useState<ItemRarity | "ALL">("ALL");
  const [onlyEquipped, setOnlyEquipped] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("strength-desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    let list = items;
    if (slotFilter !== "ALL") list = list.filter((i) => i.slot === slotFilter);
    if (rarityFilter !== "ALL") list = list.filter((i) => i.rarity === rarityFilter);
    if (onlyEquipped) list = list.filter((i) => i.isEquipped);
    const sorted = [...list];
    switch (sortKey) {
      case "strength-desc":
        sorted.sort((a, b) => b.strength - a.strength);
        break;
      case "strength-asc":
        sorted.sort((a, b) => a.strength - b.strength);
        break;
      case "newest":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "rarity":
        sorted.sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "de"));
        break;
    }
    return sorted;
  }, [items, slotFilter, rarityFilter, onlyEquipped, sortKey]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const equippedInSameSlot = selected ? items.find((i) => i.slot === selected.slot && i.isEquipped && i.id !== selected.id) : null;
  const diff = selected && equippedInSameSlot ? selected.strength - equippedInSameSlot.strength : null;

  async function handleEquipToggle() {
    if (!selected) return;
    setBusy(true);
    try {
      if (selected.isEquipped) await onUnequip(selected.id);
      else await onEquip(selected.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-bold text-[#F8F7FC] mb-3">Inventar</h2>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={slotFilter}
          onChange={(e) => setSlotFilter(e.target.value as SlotFilter)}
          aria-label="Nach Ausrüstungsplatz filtern"
          className="rounded-lg bg-[#171720] border border-[#292936] px-2.5 py-1.5 text-xs font-semibold text-[#C8C5D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]"
        >
          <option value="ALL">Alle Plätze</option>
          {EQUIPMENT_SLOT_ORDER.map((s) => (
            <option key={s} value={s}>
              {EQUIPMENT_SLOT_META[s].label}
            </option>
          ))}
        </select>

        <select
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value as ItemRarity | "ALL")}
          aria-label="Nach Seltenheit filtern"
          className="rounded-lg bg-[#171720] border border-[#292936] px-2.5 py-1.5 text-xs font-semibold text-[#C8C5D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]"
        >
          <option value="ALL">Alle Seltenheiten</option>
          {RARITY_ORDER.map((r) => (
            <option key={r} value={r}>
              {RARITY_META[r].label}
            </option>
          ))}
        </select>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          aria-label="Sortierung"
          className="rounded-lg bg-[#171720] border border-[#292936] px-2.5 py-1.5 text-xs font-semibold text-[#C8C5D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]"
        >
          <option value="strength-desc">Stärkste zuerst</option>
          <option value="strength-asc">Schwächste zuerst</option>
          <option value="newest">Neueste zuerst</option>
          <option value="rarity">Seltenheit</option>
          <option value="name">Name</option>
        </select>

        <button
          type="button"
          onClick={() => setOnlyEquipped((v) => !v)}
          aria-pressed={onlyEquipped}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
            onlyEquipped ? "border-[#A855F7] bg-[#A855F7]/15 text-[#D8B4FE]" : "border-[#292936] text-[#C8C5D2]"
          }`}
        >
          Nur ausgerüstet
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[#8D8998] py-6 text-center">Keine Gegenstände gefunden.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} selected={item.id === selectedId} onSelect={() => setSelectedId(item.id === selectedId ? null : item.id)} />
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-5 rounded-2xl border border-[#292936] bg-[#171720] p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-bold text-[#F8F7FC]">{selected.name}</div>
              <div className="text-xs text-[#8D8998]">
                {RARITY_META[selected.rarity].label} · {EQUIPMENT_SLOT_META[selected.slot].label} · Stärke {selected.strength}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {itemStats(selected).map((s) => (
                  <span key={s.label} className="text-[11px] text-[#C8C5D2] bg-[#111118] border border-[#292936] rounded-full px-2 py-0.5">
                    {s.label} {s.value}
                  </span>
                ))}
              </div>
              {diff !== null && (
                <p className={`text-sm font-bold mt-2 ${diff > 0 ? "text-[#34D399]" : diff < 0 ? "text-[#FB7185]" : "text-[#C8C5D2]"}`}>
                  {diff > 0 ? `+${diff}` : diff} Heldenstärke gegenüber aktuell ausgerüstet
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => onFavorite(selected.id)}>
                <Star className={`h-4 w-4 ${selected.isFavorite ? "fill-[#FACC15] text-[#FACC15]" : ""}`} />
                Favorit
              </Button>
              <Button size="sm" onClick={handleEquipToggle} loading={busy}>
                {selected.isEquipped ? "Ablegen" : "Ausrüsten"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
