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
 * not a second hand-drawn style but a derived variant (the source hair strands extruded
 * downward past the shoulders, see generate-long-hair.cjs in the Abschlussbericht), which is
 * why there are two options here rather than the ~8 originally envisioned. Kept as a keyed
 * lookup (not a bare string) so more styles can be added later without changing call sites. */
export type HairStyleKey = "kurz" | "lang";
export const HAIR_STYLE_OPTIONS: { key: HairStyleKey; label: string }[] = [
  { key: "kurz", label: "Kurz" },
  { key: "lang", label: "Lang" },
];

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

export function equipmentIconSrc(slot: EquipmentSlot, weaponType: WeaponType | null, rarity: ItemRarity): string {
  if (slot === "WEAPON") {
    const type = weaponType ?? "SWORD";
    return `/hero/weapons/${WEAPON_TYPE_DIR[type]}/${RARITY_DIR[rarity]}/item.png`;
  }
  return `/hero/armor/${ARMOR_SLOT_DIR[slot]}/${RARITY_DIR[rarity]}/item.png`;
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
