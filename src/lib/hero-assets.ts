import type { EquipmentSlot, ItemRarity, PetSpecies, WeaponType } from "@prisma/client";

/** Single source of truth for every hero-system image path -- nothing else in the codebase
 * should hard-code a `/hero/...` string. All assets were extracted from the five source
 * sprite sheets provided for this feature (see the Abschlussbericht for how each sheet was
 * split) and live under `public/hero/`. */

export type HeroCharacterTypeLower = "male" | "female";
export type SkinToneKey = "very-light" | "light" | "medium" | "dark" | "very-dark";
export type HairColorKey = "black" | "brown" | "blonde" | "red" | "gray" | "purple";

export const SKIN_TONE_OPTIONS: { key: SkinToneKey; label: string; swatch: string }[] = [
  { key: "very-light", label: "Sehr hell", swatch: "#F4D5B7" },
  { key: "light", label: "Hell", swatch: "#DFB177" },
  { key: "medium", label: "Mittel", swatch: "#BA875A" },
  { key: "dark", label: "Dunkel", swatch: "#805435" },
  { key: "very-dark", label: "Sehr dunkel", swatch: "#523624" },
];

export const HAIR_COLOR_OPTIONS: { key: HairColorKey; label: string; swatch: string }[] = [
  { key: "black", label: "Schwarz", swatch: "#1E1A18" },
  { key: "brown", label: "Braun", swatch: "#88441D" },
  { key: "blonde", label: "Blond", swatch: "#D8B260" },
  { key: "red", label: "Rot", swatch: "#A33F21" },
  { key: "gray", label: "Grau", swatch: "#A3A3A8" },
  { key: "purple", label: "Lila", swatch: "#824EB2" },
];

/** The provided character sheet contains exactly one drawn hairstyle per gender -- "lang" is
 * not a second hand-drawn style but a derived variant (twin tapered locks extruded from the
 * existing hair mass down past the shoulders, see generate-long-hair.cjs in the
 * Abschlussbericht), which is why there are two options here rather than the ~8 originally
 * envisioned. Kept as a keyed lookup (not a bare string) so more styles can be added later
 * without changing call sites. */
export type HairStyleKey = "kurz" | "lang";
export const HAIR_STYLE_OPTIONS: { key: HairStyleKey; label: string }[] = [
  { key: "kurz", label: "Kurz" },
  { key: "lang", label: "Lang" },
];

/** There is only one drawn base body per gender (a single flat sprite, not body-part layers),
 * and every armor piece is anchored to it via fixed percentage zones (see ARMOR_ZONES in
 * character-sprite.tsx) -- so a body build can only safely change the *scale* of the whole
 * character (base + armor together, so armor never drifts out of alignment), not reshape
 * individual body parts (shoulders/waist/arms independently) without new source art. Purely
 * cosmetic either way: never affects level/XP/items/equipment/strength/pet/rewards. */
export type BodyBuildKey = "duenn" | "normal" | "muskuloes" | "kraeftig" | "stabil";
export const BODY_BUILD_OPTIONS: { key: BodyBuildKey; label: string; description: string; scaleX: number; scaleY: number }[] = [
  { key: "duenn", label: "Dünn", description: "Schlank und leicht", scaleX: 0.9, scaleY: 1.03 },
  { key: "normal", label: "Normal", description: "Ausgewogene Statur", scaleX: 1, scaleY: 1 },
  { key: "muskuloes", label: "Muskulös", description: "Athletisch und definiert", scaleX: 1.07, scaleY: 0.99 },
  { key: "kraeftig", label: "Kräftig", description: "Breit und wuchtig", scaleX: 1.14, scaleY: 0.97 },
  { key: "stabil", label: "Stabil", description: "Fülliger und bodenständig", scaleX: 1.12, scaleY: 1 },
];
export const BODY_BUILD_META: Record<BodyBuildKey, { label: string; scaleX: number; scaleY: number }> = Object.fromEntries(
  BODY_BUILD_OPTIONS.map((o) => [o.key, { label: o.label, scaleX: o.scaleX, scaleY: o.scaleY }])
) as Record<BodyBuildKey, { label: string; scaleX: number; scaleY: number }>;

export function characterVariantSrc(
  gender: HeroCharacterTypeLower,
  skinTone: SkinToneKey,
  hairColor: HairColorKey,
  hairStyle: HairStyleKey = "kurz"
): string {
  const dir = hairStyle === "lang" ? "variants-long" : "variants";
  return `/hero/characters/${gender}/${dir}/${skinTone}--${hairColor}.png`;
}

export function characterBaseSrc(gender: HeroCharacterTypeLower, angle: "front" | "side" | "back" = "front"): string {
  return `/hero/characters/${gender}/${angle}.png`;
}

const ARMOR_SLOT_DIR: Record<Exclude<EquipmentSlot, "WEAPON">, string> = {
  HELMET: "helmet",
  CHEST: "chest",
  PANTS: "pants",
  SHOES: "shoes",
};

const WEAPON_TYPE_DIR: Record<WeaponType, string> = {
  KATANA: "katana",
  GREATSWORD: "greatsword",
  DAGGER: "dagger",
  SWORD: "sword",
  SPEAR: "spear",
};

const RARITY_DIR: Record<ItemRarity, string> = {
  COMMON: "common",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary",
};

/** `armorSetKey` (e.g. "void-guard") selects one of the 12 named sets extracted from the
 * 48-piece reference sheet -- every armor item gets one (rolled on creation, backfilled for
 * older items, see hero-service.ts), so the plain rarity-only path below is only a fallback
 * for the brief moment before a legacy item's backfill has run. */
export function equipmentIconSrc(slot: EquipmentSlot, weaponType: WeaponType | null, rarity: ItemRarity, armorSetKey?: string | null): string {
  if (slot === "WEAPON") {
    const type = weaponType ?? "SWORD";
    return `/hero/weapons/${WEAPON_TYPE_DIR[type]}/${RARITY_DIR[rarity]}/item.png`;
  }
  if (armorSetKey) return armorSetIconSrc(slot, armorSetKey);
  return `/hero/armor/${ARMOR_SLOT_DIR[slot]}/${RARITY_DIR[rarity]}/item.png`;
}

export function armorSetIconSrc(slot: Exclude<EquipmentSlot, "WEAPON">, armorSetKey: string): string {
  return `/hero/armor-sets/${armorSetKey}/${ARMOR_SLOT_DIR[slot]}-icon.png`;
}

const PET_SPECIES_DIR: Record<PetSpecies, string> = {
  WOLF: "wolf",
  SNAKE: "snake",
  LION: "lion",
  TIGER: "tiger",
  BEAR: "bear",
  EAGLE: "eagle",
  PANTHER: "panther",
};

export function petSpriteSrc(species: PetSpecies, stage: 1 | 2 | 3 | 4): string {
  return `/hero/pets/${PET_SPECIES_DIR[species]}/stage-${stage}.png`;
}
