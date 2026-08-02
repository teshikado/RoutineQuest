"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { EquipmentSlot, HeroCharacterType, PetSpecies } from "@prisma/client";
import { Sparkles, Shield, Sword, Gift, History, PawPrint, Drumstick, User, ChevronRight, Pencil } from "lucide-react";
import { useToast } from "@/components/toast";
import { EQUIPMENT_SLOT_META, EQUIPMENT_SLOT_ORDER, PET_SPECIES_META, PET_STAGE_META, RARITY_META } from "@/lib/hero-constants";
import type { HairColorKey, HairStyleKey, SkinToneKey } from "@/lib/hero-assets";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { CharacterSprite } from "./character-sprite";
import { EquipmentSprite } from "./equipment-sprite";
import { PetSprite } from "./pet-sprite";
import { CharacterCreationWizard } from "./character-creation-wizard";
import { PetPanel } from "./pet-panel";
import { FoodPanel } from "./food-panel";
import { InventoryPanel } from "./inventory-panel";
import { RewardsPanel } from "./rewards-panel";
import { HistoryPanel } from "./history-panel";
import type { HeroPageData, HeroRewardClaim } from "./hero-types";

const TABS = [
  { key: "character", label: "Charakter", icon: User },
  { key: "strength", label: "Heldenstärke", icon: Sword },
  { key: "equipment", label: "Ausrüstung", icon: Shield },
  { key: "inventory", label: "Inventar", icon: Sparkles },
  { key: "pet", label: "Haustier", icon: PawPrint },
  { key: "food", label: "Futter", icon: Drumstick },
  { key: "rewards", label: "Belohnungen", icon: Gift },
  { key: "history", label: "Verlauf", icon: History },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const GENERIC_ERROR = "Etwas ist schiefgelaufen. Bitte versuche es erneut.";

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? GENERIC_ERROR);
  return data;
}

export function HeroClient({ data }: { data: HeroPageData }) {
  const router = useRouter();
  const { showToast } = useToast();
  const reducedMotion = usePrefersReducedMotion();
  const [activeTab, setActiveTab] = useState<TabKey>("character");
  const [evolutionAcked, setEvolutionAcked] = useState(false);
  const [editingAppearance, setEditingAppearance] = useState(false);

  const openedItems = useMemo(() => data.items.filter((i) => i.rewardClaim?.openedAt), [data.items]);

  const equippedItems = data.equippedItems;
  const equippedBySlot = useMemo(() => {
    const map: Partial<Record<EquipmentSlot, HeroPageData["equippedItems"][number]>> = {};
    for (const item of equippedItems) map[item.slot] = item;
    return map;
  }, [equippedItems]);

  async function handleCompleteCharacter(input: {
    heroName: string;
    characterType: HeroCharacterType;
    skinTone: SkinToneKey;
    hairColor: HairColorKey;
    hairStyle: HairStyleKey;
  }) {
    try {
      await postJson("/api/hero/character", input);
      setEditingAppearance(false);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : GENERIC_ERROR, "error");
    }
  }

  async function handleSelectPet(species: PetSpecies) {
    try {
      await postJson("/api/hero/pet", { species });
      showToast("Haustier ausgewählt!", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : GENERIC_ERROR, "error");
    }
  }

  async function handleFeed() {
    try {
      await postJson("/api/hero/pet/feed");
      showToast("+10 Fleisch verfüttert", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Dein Haustier konnte nicht gefüttert werden.", "error");
      throw err;
    }
  }

  async function handleEquip(itemId: string) {
    try {
      await postJson("/api/hero/equip", { itemId });
      showToast("Gegenstand ausgerüstet.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Der Gegenstand konnte nicht ausgerüstet werden.", "error");
    }
  }

  async function handleUnequip(itemId: string) {
    try {
      await postJson("/api/hero/unequip", { itemId });
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : GENERIC_ERROR, "error");
    }
  }

  async function handleFavorite(itemId: string) {
    try {
      await postJson("/api/hero/favorite", { itemId });
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : GENERIC_ERROR, "error");
    }
  }

  async function handleEquipSet(armorSetKey: string) {
    try {
      await postJson("/api/hero/equip-set", { armorSetKey });
      showToast("Vollständiges Set ausgerüstet.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : GENERIC_ERROR, "error");
    }
  }

  async function handleOpenReward(claimId: string): Promise<HeroRewardClaim> {
    try {
      const result = await postJson(`/api/hero/rewards/${claimId}/open`);
      router.refresh();
      return result.claim as HeroRewardClaim;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Diese Belohnung konnte nicht geöffnet werden.", "error");
      throw err;
    }
  }

  async function handleOpenAll() {
    try {
      await postJson("/api/hero/rewards/open-all");
      showToast("Alle Belohnungen wurden geöffnet.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : GENERIC_ERROR, "error");
    }
  }

  async function handleAcknowledgeEvolution() {
    setEvolutionAcked(true);
    try {
      await postJson("/api/hero/pet/acknowledge-evolution");
      router.refresh();
    } catch {
      // Non-critical -- worst case the animation shows again next visit.
    }
  }

  if (data.needsCharacterSetup) {
    return (
      <CharacterCreationWizard
        isLegacyWelcome={data.isLegacyWelcome}
        isAppearanceUpgradeOnly={data.isAppearanceUpgradeOnly}
        level={data.level}
        onComplete={handleCompleteCharacter}
      />
    );
  }

  const appearance = {
    characterType: data.profile.characterType ?? "MALE",
    skinTone: data.profile.skinTone as SkinToneKey,
    hairColor: data.profile.hairColor as HairColorKey,
    // Pre-existing profiles carry the old "natuerlich" default from before the "lang" style
    // existed -- treat anything that isn't a known key as "kurz" rather than erroring.
    hairStyle: (data.profile.hairStyle === "lang" ? "lang" : "kurz") as HairStyleKey,
  };
  const equippedForSprite = Object.fromEntries(
    Object.entries(equippedBySlot).map(([slot, item]) => [
      slot,
      { slot: item!.slot, rarity: item!.rarity, weaponType: item!.weaponType, armorSetKey: item!.armorSetKey },
    ])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#F8F7FC] flex items-center gap-2">
          <Sword className="h-6 w-6 text-[#A855F7]" /> Held
        </h1>
        <p className="text-[#C8C5D2] mt-1">
          {data.profile.heroName || "Dein Held"} · Level {data.level}
        </p>
      </div>

      {data.pendingClaims.length > 0 && (
        <button
          type="button"
          onClick={() => setActiveTab("rewards")}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-[#A855F7]/50 bg-[#A855F7]/10 px-4 py-3 text-left hover:bg-[#A855F7]/15 transition-colors focus-visible:outline-none"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[#D8B4FE]">
            <Gift className="h-4 w-4" />
            {data.pendingClaims.length} ungeöffnete {data.pendingClaims.length === 1 ? "Belohnung" : "Belohnungen"}
          </span>
          <ChevronRight className="h-4 w-4 text-[#D8B4FE]" />
        </button>
      )}

      {!data.pet && (
        <button
          type="button"
          onClick={() => setActiveTab("pet")}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-[#292936] bg-[#111118] px-4 py-3 text-left hover:border-[#3D2A5C] transition-colors focus-visible:outline-none"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[#C8C5D2]">
            <PawPrint className="h-4 w-4 text-[#A855F7]" /> Wähle jetzt dein Haustier
          </span>
          <ChevronRight className="h-4 w-4 text-[#8D8998]" />
        </button>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={active}
              className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none ${
                active ? "bg-[#171720] text-[#F8F7FC] shadow-[inset_0_0_0_1px_rgba(168,85,247,0.4)]" : "text-[#8D8998] hover:text-[#C8C5D2] hover:bg-[#171720]"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "text-[#A855F7]" : ""}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: reducedMotion ? 0.1 : 0.2 }}
        >
          {activeTab === "character" && (
            <div className="rounded-2xl border border-[#292936] bg-[#111118] p-6 flex flex-col items-center gap-4">
              <div className="flex items-end justify-center gap-2">
                <CharacterSprite appearance={appearance} equipped={equippedForSprite} reducedMotion={reducedMotion} className="w-48 h-64" />
                {data.pet && data.stage && (
                  <PetSprite
                    species={data.pet.species}
                    stage={data.stage}
                    withPodium
                    className="w-24 h-28 mb-2"
                    title={`${PET_SPECIES_META[data.pet.species].label}, Stufe ${data.stage}`}
                  />
                )}
              </div>
              <div className="text-center">
                <div className="text-lg font-extrabold text-[#F8F7FC]">{data.profile.heroName || "Namenloser Held"}</div>
                <div className="text-sm text-[#C8C5D2]">Level {data.level}</div>
                <div className="text-2xl font-extrabold text-[#A855F7] mt-2 tabular-nums">Heldenstärke: {data.heroStrength}</div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAppearance(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#A855F7] hover:text-[#C084FC] rounded-lg px-3 py-1.5 hover:bg-[#171720] transition-colors focus-visible:outline-none"
              >
                <Pencil className="h-3.5 w-3.5" /> Charakterdarstellung ändern
              </button>
            </div>
          )}

          {activeTab === "strength" && (
            <div className="rounded-2xl border border-[#292936] bg-[#111118] p-5 space-y-3">
              <h2 className="font-bold text-[#F8F7FC]">Heldenstärke: {data.heroStrength}</h2>
              <div className="divide-y divide-[#292936]">
                <StrengthRow label={`Basis (Level ${data.level} × 5)`} value={data.level * 5} />
                {EQUIPMENT_SLOT_ORDER.map((slot) => (
                  <StrengthRow key={slot} label={EQUIPMENT_SLOT_META[slot].label} value={data.equipmentStrengthByLot[slot]} />
                ))}
                <StrengthRow label="Haustierbonus" value={data.petBonus} />
                <StrengthRow label="Gesamt" value={data.heroStrength} bold />
              </div>
            </div>
          )}

          {activeTab === "equipment" && (
            <div className="rounded-2xl border border-[#292936] bg-[#111118] p-5">
              <h2 className="font-bold text-[#F8F7FC] mb-3">Aktuelle Ausrüstung</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EQUIPMENT_SLOT_ORDER.map((slot) => {
                  const item = equippedBySlot[slot];
                  return (
                    <div key={slot} className="flex items-center gap-3 rounded-xl border border-[#292936] bg-[#171720] p-3">
                      {item ? (
                        <EquipmentSprite slot={slot} weaponType={item.weaponType} rarity={item.rarity} armorSetKey={item.armorSetKey} className="w-14 h-14 shrink-0" title={item.name} />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-[#111118] flex items-center justify-center text-[10px] text-[#5F5B68] shrink-0">Leer</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#8D8998]">{EQUIPMENT_SLOT_META[slot].label}</div>
                        {item ? (
                          <>
                            <div className="text-sm font-semibold text-[#F8F7FC] truncate">{item.name}</div>
                            <div className="text-xs" style={{ color: RARITY_META[item.rarity].color }}>
                              {RARITY_META[item.rarity].label} · Stärke {item.strength}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-[#5F5B68]">Nicht ausgerüstet</div>
                        )}
                      </div>
                      {item && (
                        <button
                          type="button"
                          onClick={() => handleUnequip(item.id)}
                          className="text-xs font-semibold text-[#8D8998] hover:text-[#FB7185] transition-colors shrink-0"
                        >
                          Ablegen
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "inventory" && (
            <InventoryPanel items={openedItems} onEquip={handleEquip} onUnequip={handleUnequip} onFavorite={handleFavorite} onEquipSet={handleEquipSet} />
          )}

          {activeTab === "pet" && (
            <PetPanel pet={data.pet} level={data.level} stage={data.stage} petBonus={data.petBonus} onSelect={handleSelectPet} />
          )}

          {activeTab === "food" && (
            <FoodPanel pet={data.pet} meatBalance={data.profile.meatBalance} todayMeat={data.todayMeat} onFeed={handleFeed} />
          )}

          {activeTab === "rewards" && (
            <RewardsPanel pendingClaims={data.pendingClaims} onOpen={handleOpenReward} onOpenAll={handleOpenAll} onEquip={handleEquip} />
          )}

          {activeTab === "history" && <HistoryPanel claims={data.claims} />}
        </motion.div>
      </AnimatePresence>

      {data.justEvolved && data.pet && data.stage && !evolutionAcked && (
        <PetEvolutionModal species={data.pet.species} stage={data.stage} onClose={handleAcknowledgeEvolution} reducedMotion={reducedMotion} />
      )}

      {editingAppearance && (
        <CharacterCreationWizard
          isLegacyWelcome={false}
          isAppearanceUpgradeOnly={false}
          isEditMode
          level={data.level}
          initial={{ heroName: data.profile.heroName ?? "", ...appearance }}
          onComplete={handleCompleteCharacter}
          onCancel={() => setEditingAppearance(false)}
        />
      )}
    </div>
  );
}

function StrengthRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className={`text-sm ${bold ? "font-bold text-[#F8F7FC]" : "text-[#C8C5D2]"}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? "font-extrabold text-[#A855F7]" : "font-semibold text-[#F8F7FC]"}`}>{value}</span>
    </div>
  );
}

function PetEvolutionModal({
  species,
  stage,
  onClose,
  reducedMotion,
}: {
  species: PetSpecies;
  stage: 1 | 2 | 3 | 4;
  onClose: () => void;
  reducedMotion: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050507]/95 backdrop-blur-sm p-4">
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0.15 : 0.5 }}
        className="w-full max-w-sm rounded-2xl border border-[#A855F7] bg-[#111118] p-6 text-center shadow-[var(--shadow-purple-lg)]"
      >
        <div className="text-sm font-extrabold text-[#D8B4FE] mb-2">Dein Haustier entwickelt sich!</div>
        <PetSprite species={species} stage={stage} withPodium className="w-48 h-40 mx-auto mb-3" title={PET_SPECIES_META[species].label} />
        <div className="text-lg font-extrabold text-[#F8F7FC]">
          {PET_SPECIES_META[species].label} hat {PET_STAGE_META[stage].label} erreicht.
        </div>
        <div className="text-sm text-[#34D399] font-semibold mt-1">+{PET_STAGE_META[stage].totalBonus} Heldenstärke</div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-xl bg-[#A855F7] hover:bg-[#C026FF] transition-colors text-white text-sm font-semibold px-4 py-2 focus-visible:outline-none"
        >
          Weiter
        </button>
      </motion.div>
    </div>
  );
}
