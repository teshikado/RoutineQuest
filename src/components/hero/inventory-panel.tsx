"use client";

import { useMemo, useState } from "react";
import type { EquipmentSlot, ItemRarity } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ARMOR_SET_KEY_ORDER,
  ARMOR_SET_META,
  EQUIPMENT_SLOT_META,
  EQUIPMENT_SLOT_ORDER,
  RARITY_META,
  RARITY_ORDER,
  WEAPON_TYPE_META,
  type ArmorSetKey,
} from "@/lib/hero-constants";
import { armorSetIconSrc } from "@/lib/hero-assets";
import { EquipmentSprite } from "./equipment-sprite";
import { CharacterSprite, type EquippedPiece } from "./character-sprite";
import type { HeroEquipmentItem } from "./hero-types";
import { Star, Layers, X } from "lucide-react";
import Image from "next/image";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

/** Neutral preview appearance -- the set preview is about the armor, not the viewer's own
 * cosmetic choices, so both preview figures use the same fixed skin/hair rather than
 * threading the real profile through just for this. */
const PREVIEW_APPEARANCE = { skinTone: "medium" as const, hairColor: "brown" as const, hairStyle: "kurz" as const };

function SetPreviewModal({ setKey, ownedSlots, onClose }: { setKey: ArmorSetKey; ownedSlots: Set<EquipmentSlot>; onClose: () => void }) {
  const reducedMotion = usePrefersReducedMotion();
  const meta = ARMOR_SET_META[setKey];
  const rarityMeta = RARITY_META[meta.rarity];
  const equipped: Partial<Record<EquipmentSlot, EquippedPiece>> = {};
  for (const slot of ARMOR_SLOTS_FOR_SET) {
    equipped[slot] = { slot, rarity: meta.rarity, weaponType: null, armorSetKey: setKey };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050507]/90 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border p-6"
        style={{ borderColor: rarityMeta.color, background: "#111118", boxShadow: rarityMeta.glow }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: rarityMeta.color }}>
              {rarityMeta.label}
            </div>
            <h3 className="text-lg font-extrabold text-[#F8F7FC]">{meta.label}</h3>
            <p className="text-xs text-[#8D8998] mt-1">{meta.theme}</p>
            <p className="text-xs font-semibold text-[#C8C5D2] mt-1">{ownedSlots.size} von 4 Teilen gesammelt</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Vorschau schließen" className="text-[#8D8998] hover:text-[#F8F7FC]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center">
            <CharacterSprite
              appearance={{ characterType: "MALE", ...PREVIEW_APPEARANCE }}
              equipped={equipped}
              reducedMotion={reducedMotion}
              className="w-32 h-44"
            />
            <span className="text-xs text-[#8D8998] mt-1">Männlich</span>
          </div>
          <div className="flex flex-col items-center">
            <CharacterSprite
              appearance={{ characterType: "FEMALE", ...PREVIEW_APPEARANCE }}
              equipped={equipped}
              reducedMotion={reducedMotion}
              className="w-32 h-44"
            />
            <span className="text-xs text-[#8D8998] mt-1">Weiblich</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
          {ARMOR_SLOTS_FOR_SET.map((slot) => (
            <div key={slot} className={`relative aspect-square rounded-lg border ${ownedSlots.has(slot) ? "border-[#3D2A5C] bg-[#171720]" : "border-[#292936] bg-black/30"}`}>
              <Image src={armorSetIconSrc(slot, setKey)} alt={EQUIPMENT_SLOT_META[slot].label} fill sizes="80px" className={`object-contain p-1 ${ownedSlots.has(slot) ? "" : "opacity-30"}`} style={{ imageRendering: "pixelated" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type SlotFilter = "ALL" | EquipmentSlot;
type SetFilter = "ALL" | ArmorSetKey;
type SortKey = "strength-desc" | "strength-asc" | "newest" | "rarity" | "name";

const ARMOR_SLOTS_FOR_SET: Exclude<EquipmentSlot, "WEAPON">[] = ["HELMET", "CHEST", "PANTS", "SHOES"];

function SetCollectionCard({
  setKey,
  ownedSlots,
  onEquipSet,
  equipping,
  onPreview,
}: {
  setKey: ArmorSetKey;
  ownedSlots: Set<EquipmentSlot>;
  onEquipSet: (setKey: string) => Promise<void>;
  equipping: boolean;
  onPreview: (setKey: ArmorSetKey) => void;
}) {
  const meta = ARMOR_SET_META[setKey];
  const rarityMeta = RARITY_META[meta.rarity];
  const complete = ARMOR_SLOTS_FOR_SET.every((s) => ownedSlots.has(s));
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-xl border border-[#292936] bg-[#171720] p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-bold text-[#F8F7FC]">{meta.label}</div>
          <div className="text-[11px] font-semibold" style={{ color: rarityMeta.color }}>
            {rarityMeta.label} · {ownedSlots.size} von 4 Teilen gesammelt
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {ARMOR_SLOTS_FOR_SET.map((slot) => {
          const owned = ownedSlots.has(slot);
          return (
            <div
              key={slot}
              className={`relative aspect-square rounded-lg border ${owned ? "border-[#3D2A5C] bg-[#111118]" : "border-[#292936] bg-black/30"}`}
              title={EQUIPMENT_SLOT_META[slot].label}
            >
              {owned ? (
                <Image src={armorSetIconSrc(slot, setKey)} alt={`${EQUIPMENT_SLOT_META[slot].label} des Sets ${meta.label}`} fill sizes="80px" className="object-contain p-1" style={{ imageRendering: "pixelated" }} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[9px] text-[#3F3B48]">?</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => onPreview(setKey)}>
          Vorschau
        </Button>
        {complete && (
          <Button
            size="sm"
            className="flex-1"
            loading={busy}
            disabled={equipping}
            onClick={async () => {
              setBusy(true);
              try {
                await onEquipSet(setKey);
              } finally {
                setBusy(false);
              }
            }}
          >
            Set ausrüsten
          </Button>
        )}
      </div>
    </div>
  );
}

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
      <EquipmentSprite slot={item.slot} weaponType={item.weaponType} rarity={item.rarity} armorSetKey={item.armorSetKey} className="w-full h-16 mb-2" title={item.name} />
      <div className="text-xs font-semibold text-[#F8F7FC] truncate">{item.name}</div>
      <div className="text-[11px] text-[#8D8998] truncate">
        {meta.label}
        {item.armorSetKey && ARMOR_SET_META[item.armorSetKey as ArmorSetKey] ? ` · ${ARMOR_SET_META[item.armorSetKey as ArmorSetKey].label}` : ""}
        {" · "}
        {EQUIPMENT_SLOT_META[item.slot].label}
        {item.weaponType ? ` · ${WEAPON_TYPE_META[item.weaponType].label}` : ""}
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
  onEquipSet,
}: {
  items: HeroEquipmentItem[];
  onEquip: (itemId: string) => Promise<void>;
  onUnequip: (itemId: string) => Promise<void>;
  onFavorite: (itemId: string) => Promise<void>;
  onEquipSet: (setKey: string) => Promise<void>;
}) {
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("ALL");
  const [rarityFilter, setRarityFilter] = useState<ItemRarity | "ALL">("ALL");
  const [setFilter, setSetFilter] = useState<SetFilter>("ALL");
  const [onlyEquipped, setOnlyEquipped] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("strength-desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [equippingSet, setEquippingSet] = useState(false);
  const [previewSetKey, setPreviewSetKey] = useState<ArmorSetKey | null>(null);

  const ownedSetSlots = useMemo(() => {
    const map = new Map<ArmorSetKey, Set<EquipmentSlot>>();
    for (const item of items) {
      if (!item.armorSetKey) continue;
      const key = item.armorSetKey as ArmorSetKey;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(item.slot);
    }
    return map;
  }, [items]);
  const discoveredSets = ARMOR_SET_KEY_ORDER.filter((k) => ownedSetSlots.has(k));

  async function handleEquipSet(setKey: string) {
    setEquippingSet(true);
    try {
      await onEquipSet(setKey);
    } finally {
      setEquippingSet(false);
    }
  }

  const filtered = useMemo(() => {
    let list = items;
    if (slotFilter !== "ALL") list = list.filter((i) => i.slot === slotFilter);
    if (rarityFilter !== "ALL") list = list.filter((i) => i.rarity === rarityFilter);
    if (setFilter !== "ALL") list = list.filter((i) => i.armorSetKey === setFilter);
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
  }, [items, slotFilter, rarityFilter, setFilter, onlyEquipped, sortKey]);

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

      {discoveredSets.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8D8998] mb-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Rüstungssets
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {discoveredSets.map((setKey) => (
              <SetCollectionCard
                key={setKey}
                setKey={setKey}
                ownedSlots={ownedSetSlots.get(setKey)!}
                onEquipSet={handleEquipSet}
                equipping={equippingSet}
                onPreview={setPreviewSetKey}
              />
            ))}
          </div>
        </div>
      )}

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
          value={setFilter}
          onChange={(e) => setSetFilter(e.target.value as SetFilter)}
          aria-label="Nach Set filtern"
          className="rounded-lg bg-[#171720] border border-[#292936] px-2.5 py-1.5 text-xs font-semibold text-[#C8C5D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]"
        >
          <option value="ALL">Alle Sets</option>
          {discoveredSets.map((k) => (
            <option key={k} value={k}>
              {ARMOR_SET_META[k].label}
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

      {previewSetKey && (
        <SetPreviewModal
          setKey={previewSetKey}
          ownedSlots={ownedSetSlots.get(previewSetKey) ?? new Set()}
          onClose={() => setPreviewSetKey(null)}
        />
      )}
    </Card>
  );
}
