import type { EquipmentSlot, ItemRarity, PetSpecies, WeaponType } from "@prisma/client";

/** Central, tweakable balance knobs for the whole Held (hero) system -- kept in one file so
 * probabilities/ranges/bonuses can be rebalanced without touching the generation logic. */

export const RARITY_META: Record<
  ItemRarity,
  { label: string; color: string; glow: string; strengthRange: [number, number] }
> = {
  COMMON: { label: "Gewöhnlich", color: "#9CA3AF", glow: "0 2px 10px rgba(156,163,175,0.25)", strengthRange: [5, 15] },
  RARE: { label: "Selten", color: "#38BDF8", glow: "0 4px 18px rgba(56,189,248,0.35)", strengthRange: [16, 30] },
  EPIC: { label: "Episch", color: "#A855F7", glow: "0 6px 24px rgba(168,85,247,0.45)", strengthRange: [31, 55] },
  LEGENDARY: { label: "Legendär", color: "#FACC15", glow: "0 8px 30px rgba(250,204,21,0.5)", strengthRange: [56, 90] },
};

export const RARITY_ORDER: ItemRarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"];

/** Normal per-level roll. Must sum to 100. */
export const RARITY_WEIGHTS_NORMAL: Record<ItemRarity, number> = {
  COMMON: 40,
  RARE: 30,
  EPIC: 20,
  LEGENDARY: 10,
};

/** Every 10th level (10, 20, 30, ...) uses this instead -- guarantees epic or legendary. */
export const RARITY_WEIGHTS_MILESTONE: Partial<Record<ItemRarity, number>> = {
  EPIC: 50,
  LEGENDARY: 50,
};

export const MILESTONE_LEVEL_INTERVAL = 10;

/** Small per-level strength bonus added on top of the rarity's random base, so gear from
 * higher levels trends stronger without making rarity meaningless. Capped so a high level
 * can't make a common item outclass a legendary one from a similar level. */
export const LEVEL_STRENGTH_BONUS_CAP = 25;
export function levelStrengthBonus(level: number): number {
  return Math.min(LEVEL_STRENGTH_BONUS_CAP, Math.floor(level / 2));
}

// ---------- Armor sets ----------
// Twelve fixed thematic sets (3 per rarity), matching the 48-piece reference sheet. A set
// determines appearance/name/theme only -- strength, stats, and rarity are still rolled the
// same way as before (see generateRewardForLevel in hero-service.ts); the set is not meant
// to make one of the three same-rarity options systematically stronger than the others.
export type ArmorSetKey =
  | "iron-guard"
  | "wander-hunter"
  | "north-fur"
  | "sapphire-guard"
  | "arcane-keeper"
  | "night-runner"
  | "void-guard"
  | "rune-lord"
  | "shadow-blade"
  | "sky-warden"
  | "sun-king"
  | "star-breaker";

export const ARMOR_SET_KEYS_BY_RARITY: Record<ItemRarity, ArmorSetKey[]> = {
  COMMON: ["iron-guard", "wander-hunter", "north-fur"],
  RARE: ["sapphire-guard", "arcane-keeper", "night-runner"],
  EPIC: ["void-guard", "rune-lord", "shadow-blade"],
  LEGENDARY: ["sky-warden", "sun-king", "star-breaker"],
};

export const ARMOR_SET_META: Record<ArmorSetKey, { label: string; genitive: string; rarity: ItemRarity; theme: string }> = {
  "iron-guard": { label: "Eisenwache", genitive: "der Eisenwache", rarity: "COMMON", theme: "Einfacher, sauberer Abenteurer-Look aus Grau, Silber und Braun." },
  "wander-hunter": { label: "Wanderjäger", genitive: "des Wanderjägers", rarity: "COMMON", theme: "Beweglicher Waldläufer-Look aus Leder in Braun und Dunkelgrün." },
  "north-fur": { label: "Nordpelz", genitive: "des Nordpelzes", rarity: "COMMON", theme: "Warmer nordischer Look mit Pelzbesatz." },
  "sapphire-guard": { label: "Saphirwache", genitive: "der Saphirwache", rarity: "RARE", theme: "Silberblaue Ritterrüstung mit leuchtendem Blau." },
  "arcane-keeper": { label: "Arkanhüter", genitive: "des Arkanhüters", rarity: "RARE", theme: "Magische Rüstung mit blauem Kristall in Dunkelblau und Gold." },
  "night-runner": { label: "Nachtläufer", genitive: "des Nachtläufers", rarity: "RARE", theme: "Schlanke, dunkle Rüstung in Navy und Blau." },
  "void-guard": { label: "Leerenwache", genitive: "der Leerenwache", rarity: "EPIC", theme: "Schwere lila Kristallrüstung in Dunkellila, Violett und Schwarz." },
  "rune-lord": { label: "Runenfürst", genitive: "des Runenfürsten", rarity: "EPIC", theme: "Lila-goldene Runenrüstung mit langer verzierter Beinkleidung." },
  "shadow-blade": { label: "Schattenklinge", genitive: "der Schattenklinge", rarity: "EPIC", theme: "Elegante Schattenrüstung in Schwarz, Lila und Silber." },
  "sky-warden": { label: "Himmelswächter", genitive: "des Himmelswächters", rarity: "LEGENDARY", theme: "Geflügelte weiß-goldene Rüstung mit Blau." },
  "sun-king": { label: "Sonnenkönig", genitive: "des Sonnenkönigs", rarity: "LEGENDARY", theme: "Schwere königliche Goldrüstung in Gold, Dunkelblau und Weiß." },
  "star-breaker": { label: "Sternenbrecher", genitive: "des Sternenbrechers", rarity: "LEGENDARY", theme: "Moderne goldene Energierüstung mit leuchtendem Cyan." },
};

export const ARMOR_SET_KEY_ORDER: ArmorSetKey[] = Object.keys(ARMOR_SET_META) as ArmorSetKey[];

// ---------- Legendary styles ----------
// A purely cosmetic reskin layer for LEGENDARY armor pieces: independent of which of the 3
// legendary sets an item actually rolled as (armorSetKey), a player can choose to *display* it
// as any of these 3 styles instead. Deliberately only 3, not the 4 originally requested
// (Samurai, Himmels-Paladin, Schattenfürst, Drachenkönig) -- there is no real Samurai-themed
// armor art in this project (no East-Asian kabuto-style helm exists anywhere in the asset set)
// and this project has no illustration/generation capability, only image manipulation, so a
// 4th style cannot be produced without fabricating something. The 3 styles below reuse the
// existing, already visually distinct legendary set art under themed names that reasonably
// match 3 of the 4 requested concepts.
export type LegendaryStyleKey = "himmels-paladin" | "schattenfuerst" | "drachenkoenig";

export const LEGENDARY_STYLE_META: Record<LegendaryStyleKey, { label: string; description: string; setKey: ArmorSetKey }> = {
  "himmels-paladin": {
    label: "Himmels-Paladin",
    description: "Edle geflügelte Rüstung in Weiß und Gold mit leuchtendem Blau -- heroisch und rein.",
    setKey: "sky-warden",
  },
  "schattenfuerst": {
    label: "Schattenfürst",
    description: "Dunkle, mystische Rüstung in Schwarz und Violett mit kalten Kristallakzenten.",
    setKey: "star-breaker",
  },
  "drachenkoenig": {
    label: "Drachenkönig",
    description: "Schwere, königliche Rüstung in Gold und Dunkelblau -- mächtig und herrschaftlich.",
    setKey: "sun-king",
  },
};

export const LEGENDARY_STYLE_KEY_ORDER: LegendaryStyleKey[] = Object.keys(LEGENDARY_STYLE_META) as LegendaryStyleKey[];

/** Deterministic (not random-per-render) style assignment for legendary items that predate
 * this system -- same item always maps to the same style, across reloads and devices. */
export function deterministicLegendaryStyle(itemId: string): LegendaryStyleKey {
  let hash = 0;
  for (let i = 0; i < itemId.length; i++) hash = (hash * 31 + itemId.charCodeAt(i) + 7) >>> 0;
  return LEGENDARY_STYLE_KEY_ORDER[hash % LEGENDARY_STYLE_KEY_ORDER.length];
}

export function armorSetItemName(slot: Exclude<EquipmentSlot, "WEAPON">, setKey: ArmorSetKey): string {
  return `${EQUIPMENT_SLOT_META[slot].label} ${ARMOR_SET_META[setKey].genitive}`;
}

/** Deterministic (not random-per-render) set assignment for items that predate the set
 * system -- same item always maps to the same set, across reloads and devices. */
export function deterministicSetKeyForRarity(itemId: string, rarity: ItemRarity): ArmorSetKey {
  let hash = 0;
  for (let i = 0; i < itemId.length; i++) hash = (hash * 31 + itemId.charCodeAt(i)) >>> 0;
  const keys = ARMOR_SET_KEYS_BY_RARITY[rarity];
  return keys[hash % keys.length];
}

export const EQUIPMENT_SLOT_META: Record<EquipmentSlot, { label: string; icon: string }> = {
  HELMET: { label: "Helm", icon: "HardHat" },
  CHEST: { label: "Oberteil", icon: "Shirt" },
  PANTS: { label: "Hose", icon: "Rows3" },
  SHOES: { label: "Schuhe", icon: "Footprints" },
  WEAPON: { label: "Waffe", icon: "Swords" },
};

export const EQUIPMENT_SLOT_ORDER: EquipmentSlot[] = ["HELMET", "CHEST", "PANTS", "SHOES", "WEAPON"];

/** Equal 20% odds per slot for a normal level-up drop; if WEAPON is rolled, a weapon type
 * is then rolled uniformly among the five types below. */
export const SLOT_WEIGHTS: Record<EquipmentSlot, number> = {
  HELMET: 20,
  CHEST: 20,
  PANTS: 20,
  SHOES: 20,
  WEAPON: 20,
};

export const WEAPON_TYPE_META: Record<
  WeaponType,
  { label: string; description: string; attackShare: number; speedShare: number; critBonus: number }
> = {
  KATANA: { label: "Katana", description: "Gute Angriffskraft, gute Geschwindigkeit, leicht erhöhte kritische Trefferchance.", attackShare: 0.6, speedShare: 0.3, critBonus: 4 },
  GREATSWORD: { label: "Großschwert", description: "Sehr hohe Angriffskraft, langsamere Geschwindigkeit, hoher Stärke-Wert.", attackShare: 0.85, speedShare: 0.1, critBonus: 0 },
  DAGGER: { label: "Messer", description: "Geringere Angriffskraft, sehr hohe Geschwindigkeit, höhere kritische Trefferchance.", attackShare: 0.4, speedShare: 0.55, critBonus: 8 },
  SWORD: { label: "Schwert", description: "Ausgeglichene Werte für alle Situationen.", attackShare: 0.55, speedShare: 0.35, critBonus: 2 },
  SPEAR: { label: "Speer", description: "Gute Angriffskraft, etwas Verteidigung, ausgeglichene Geschwindigkeit.", attackShare: 0.6, speedShare: 0.25, critBonus: 1 },
};

export const WEAPON_TYPE_ORDER: WeaponType[] = ["KATANA", "GREATSWORD", "DAGGER", "SWORD", "SPEAR"];

/** How a slot's raw `strength` roll is distributed across the visible sub-stats. Values are
 * shares of `strength` (not required to sum to 1 -- some slots deliberately spread stats
 * generously so low-strength items still show meaningful numbers). Weapon uses the
 * per-weapon-type shares above instead of a fixed profile. */
export const SLOT_STAT_PROFILE: Record<Exclude<EquipmentSlot, "WEAPON">, { defense: number; health: number; attack: number; speed: number }> = {
  HELMET: { defense: 0.55, health: 0.35, attack: 0.1, speed: 0 },
  CHEST: { defense: 0.5, health: 0.35, attack: 0.15, speed: 0 },
  PANTS: { defense: 0.4, health: 0.35, attack: 0.15, speed: 0.1 },
  SHOES: { defense: 0.2, health: 0.1, attack: 0, speed: 0.7 },
};

export const PET_SPECIES_META: Record<
  PetSpecies,
  { label: string; description: string; specialization: string; statFocus: { strength?: number; speed?: number; crit?: number; defense?: number; health?: number; dodge?: number } }
> = {
  WOLF: { label: "Wolf", description: "Ein ausgeglichener Begleiter, treu und verlässlich.", specialization: "Stärke & Geschwindigkeit", statFocus: { strength: 0.55, speed: 0.45 } },
  SNAKE: { label: "Schlange", description: "Schnell, lautlos und taktisch klug.", specialization: "Kritische Trefferchance & Geschwindigkeit", statFocus: { crit: 0.55, speed: 0.45 } },
  LION: { label: "Löwe", description: "Ein mächtiger und widerstandsfähiger Begleiter.", specialization: "Stärke & Verteidigung", statFocus: { strength: 0.55, defense: 0.45 } },
  TIGER: { label: "Tiger", description: "Ein offensiver Begleiter mit enormem Angriffsdrang.", specialization: "Angriff & Geschwindigkeit", statFocus: { strength: 0.6, speed: 0.4 } },
  BEAR: { label: "Bär", description: "Ein robuster Beschützer mit viel Ausdauer.", specialization: "Leben & Verteidigung", statFocus: { health: 0.55, defense: 0.45 } },
  EAGLE: { label: "Adler", description: "Schnell, aufmerksam und immer einen Schritt voraus.", specialization: "Geschwindigkeit & kritische Trefferchance", statFocus: { speed: 0.55, crit: 0.45 } },
  PANTHER: { label: "Panther", description: "Leise, beweglich und kaum zu treffen.", specialization: "Geschwindigkeit & Ausweichen", statFocus: { speed: 0.55, dodge: 0.45 } },
};

export const PET_SPECIES_ORDER: PetSpecies[] = ["WOLF", "SNAKE", "LION", "TIGER", "BEAR", "EAGLE", "PANTHER"];

/** Pet evolves purely from the user's level -- these are the four fixed stage thresholds
 * (there is no 5th stage; level 30+ stays on stage 4 forever). */
export function petStageForLevel(level: number): 1 | 2 | 3 | 4 {
  if (level >= 30) return 4;
  if (level >= 20) return 3;
  if (level >= 10) return 2;
  return 1;
}

export const PET_STAGE_META: Record<1 | 2 | 3 | 4, { label: string; totalBonus: number; levelRequirement: number }> = {
  1: { label: "Stufe 1", totalBonus: 5, levelRequirement: 1 },
  2: { label: "Stufe 2", totalBonus: 15, levelRequirement: 10 },
  3: { label: "Stufe 3", totalBonus: 30, levelRequirement: 20 },
  4: { label: "Stufe 4", totalBonus: 50, levelRequirement: 30 },
};

// ---------- Meat / feeding economy ----------

export const MEAT_PER_TASK = 10;
export const MEAT_MAX_BALANCE = 99_999;
export const MEAT_FEED_AMOUNT = 10;
export const MEAT_DAILY_GOAL = 30;
export const MEAT_VERY_FULL_THRESHOLD = 50;

// ---------- Item naming ----------
// Weapon names: original names, organized by weapon type and rarity, not lifted from any
// existing game. Armor names are no longer a random pool -- since the set system, an armor
// item's name is derived deterministically from its slot + assigned set (armorSetItemName
// above), so the same set always produces the same name across every piece of it.

const WEAPON_NAMES: Record<WeaponType, Record<ItemRarity, string[]>> = {
  KATANA: {
    COMMON: ["Einfaches Katana", "Übungsklinge", "Rostiges Katana"],
    RARE: ["Blaues Sturmkatana", "Katana der Nachtwache", "Mondklinge"],
    EPIC: ["Katana der ewigen Nacht", "Klinge des violetten Sturms", "Sturmreißer"],
    LEGENDARY: ["Katana des lila Drachen", "Klinge der schwarzen Sonne", "Sternenschneide"],
  },
  GREATSWORD: {
    COMMON: ["Einfaches Großschwert", "Schweres Übungsschwert", "Grobe Kriegsklinge"],
    RARE: ["Großschwert der Sturmreiter", "Klinge des Nachtwächters", "Zweihänder der Wanderer"],
    EPIC: ["Großschwert des Schattenkönigs", "Klinge der Leerenwache", "Zerteiler des violetten Sturms"],
    LEGENDARY: ["Großschwert des Weltenbrechers", "Klinge der schwarzen Sonne", "Zerteiler der ewigen Nacht"],
  },
  DAGGER: {
    COMMON: ["Einfaches Messer", "Kurzes Klingenmesser", "Abgenutztes Wurfmesser"],
    RARE: ["Messer des Nachtläufers", "Schattendolch", "Klinge der stillen Jagd"],
    EPIC: ["Dolch der Leerenwache", "Messer des violetten Sturms", "Schattenreißer"],
    LEGENDARY: ["Dolch der schwarzen Sonne", "Messer des Sternenjägers", "Reißer der ewigen Nacht"],
  },
  SWORD: {
    COMMON: ["Einfaches Schwert", "Übungsschwert", "Grobe Klinge"],
    RARE: ["Schwert der Sturmwache", "Klinge des Nachtläufers", "Mondschwert"],
    EPIC: ["Klinge der ewigen Nacht", "Schwert des violetten Ritters", "Sturmklinge"],
    LEGENDARY: ["Schwert des unsterblichen Herrschers", "Klinge der schwarzen Sonne", "Sternenschwert"],
  },
  SPEAR: {
    COMMON: ["Einfacher Speer", "Grober Jagdspeer", "Abgenutzte Lanze"],
    RARE: ["Speer der Sturmreiter", "Lanze des Nachtwächters", "Wolkenspeer"],
    EPIC: ["Speer des Schattenkönigs", "Lanze der Leerenwache", "Speer des violetten Sturms"],
    LEGENDARY: ["Speer des Weltenbrechers", "Lanze der schwarzen Sonne", "Speer der ewigen Nacht"],
  },
};

export function weaponNameOptions(weaponType: WeaponType, rarity: ItemRarity): string[] {
  return WEAPON_NAMES[weaponType][rarity];
}
