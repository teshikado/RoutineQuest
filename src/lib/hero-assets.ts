import type { EquipmentSlot, ItemRarity, PetSpecies, WeaponType } from "@prisma/client";
import { LEGENDARY_STYLE_META, type LegendaryStyleKey } from "./hero-constants";
import {
  BODY_BUILD_OPTIONS,
  HAIR_STYLE_META,
  HAIR_STYLE_KEY_ORDER,
  normalizeHairStyle,
  type BodyBuildKey,
  type HairStyleKey,
} from "./hero-render-config";

export { BODY_BUILD_OPTIONS, normalizeHairStyle, type BodyBuildKey, type HairStyleKey };

/** Single source of truth for every hero-system image path -- nothing else in the codebase
 * should hard-code a `/hero/...` string. All assets were extracted from the five source
 * sprite sheets provided for this feature (see the Abschlussbericht for how each sheet was
 * split) and live under `public/hero/`. */

export type HeroCharacterTypeLower = "male" | "female";
export type SkinToneKey = "very-light" | "light" | "medium" | "dark" | "very-dark";
export type HairColorKey = "black" | "darkbrown" | "brown" | "blonde" | "red" | "gray" | "silver" | "purple";

export const SKIN_TONE_OPTIONS: { key: SkinToneKey; label: string; swatch: string }[] = [
  { key: "very-light", label: "Sehr hell", swatch: "#F4D5B7" },
  { key: "light", label: "Hell", swatch: "#DFB177" },
  { key: "medium", label: "Mittel", swatch: "#BA875A" },
  { key: "dark", label: "Dunkel", swatch: "#805435" },
  { key: "very-dark", label: "Sehr dunkel", swatch: "#523624" },
];

/** "darkbrown" and "silver" are real HSL-remapped recolors of "brown"/"gray" (own dark/mid/
 * light/highlight shading preserved, not a flat tint) -- see the Abschlussbericht for the
 * pixel-diff-based hair-mask technique used to build them without touching skin/clothing. */
export const HAIR_COLOR_OPTIONS: { key: HairColorKey; label: string; swatch: string }[] = [
  { key: "black", label: "Schwarz", swatch: "#1E1A18" },
  { key: "darkbrown", label: "Dunkelbraun", swatch: "#4A2E18" },
  { key: "brown", label: "Braun", swatch: "#88441D" },
  { key: "blonde", label: "Blond", swatch: "#D8B260" },
  { key: "red", label: "Rot", swatch: "#A33F21" },
  { key: "gray", label: "Grau", swatch: "#A3A3A8" },
  { key: "silver", label: "Silber/Weiß", swatch: "#E7EBF0" },
  { key: "purple", label: "Lila", swatch: "#824EB2" },
];

/** Eight real, independently-silhouetted hairstyles rendered as their own overlay layer on top
 * of the (now hair-free) base body -- see scripts/hero-art/generate-hairstyles.ts and
 * hero-render-config.ts. Replaces the old two-option "kurz"/"lang" system where "lang" was the
 * only non-baked-in variant; those two legacy values still resolve correctly via
 * normalizeHairStyle for any HeroProfile row saved before this change. */
export const HAIR_STYLE_OPTIONS: { key: HairStyleKey; label: string; category: "kurz" | "lang" }[] = HAIR_STYLE_KEY_ORDER.map((key) => ({
  key,
  label: HAIR_STYLE_META[key].label,
  category: HAIR_STYLE_META[key].category,
}));

/** Base body art, hair-free, reshaped per build (see scripts/hero-art/generate-bodies.ts) --
 * replaces the old single flat sprite + CSS `transform: scale()` approach: every body build is
 * now a genuinely different silhouette baked into its own PNG, not a stretched copy. */
export function characterBodySrc(gender: HeroCharacterTypeLower, bodyBuild: BodyBuildKey, skinTone: SkinToneKey): string {
  return `/hero/characters/${gender}/body/${bodyBuild}/${skinTone}.png`;
}

/** Hair overlay layer, same fixed frame as the body so it can be composited directly on top of
 * it at 0/0/100%/100% (see LAYER_ORDER in hero-render-config.ts). Accepts legacy "kurz"/"lang"
 * values too (normalized internally) so old HeroProfile rows keep rendering correctly. */
export function hairOverlaySrc(gender: HeroCharacterTypeLower, hairStyle: string, hairColor: HairColorKey): string {
  return `/hero/hairstyles/${normalizeHairStyle(hairStyle)}/${gender}/${hairColor}.png`;
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

/** `armorSetKey` (e.g. "void-guard") selects one of the 13 named sets -- every armor item gets
 * one (rolled on creation, backfilled for older items, see hero-service.ts), so the plain
 * rarity-only path below is only a fallback for the brief moment before a legacy item's
 * backfill has run.
 *
 * `legendaryStyle`, when present, takes priority over `armorSetKey` for LEGENDARY items -- it's
 * a separate cosmetic reskin field (see changeLegendaryStyle in hero-service.ts) that lets a
 * player display a legendary piece as any of the 4 legendary set looks regardless of which one
 * it actually rolled as. Shared by both equipmentIconSrc (flat inventory icon) and
 * armorOverlaySrc (body-conforming character overlay, see below) so the two never disagree on
 * which set is being displayed. */
function resolveArmorSetKey(rarity: ItemRarity, armorSetKey?: string | null, legendaryStyle?: string | null): string {
  if (rarity === "LEGENDARY" && legendaryStyle && legendaryStyle in LEGENDARY_STYLE_META) {
    return LEGENDARY_STYLE_META[legendaryStyle as LegendaryStyleKey].setKey;
  }
  return armorSetKey ?? "iron-guard";
}

export function equipmentIconSrc(
  slot: EquipmentSlot,
  weaponType: WeaponType | null,
  rarity: ItemRarity,
  armorSetKey?: string | null,
  legendaryStyle?: string | null
): string {
  if (slot === "WEAPON") {
    const type = weaponType ?? "SWORD";
    return `/hero/weapons/${WEAPON_TYPE_DIR[type]}/${RARITY_DIR[rarity]}/item.png`;
  }
  return armorSetIconSrc(slot, resolveArmorSetKey(rarity, armorSetKey, legendaryStyle));
}

export function armorSetIconSrc(slot: Exclude<EquipmentSlot, "WEAPON">, armorSetKey: string): string {
  return `/hero/armor-sets/${armorSetKey}/${ARMOR_SLOT_DIR[slot]}-icon.png`;
}

/** Body-conforming character overlay -- a *different* asset from the flat inventory icon above.
 * Generated by scripts/hero-art/generate-armor-overlays.ts: the original hand-painted icon art
 * (same gems/plates/seams, nothing redrawn) is placed on the character's own native canvas and
 * then reshaped row-by-row so its rendered width matches the real body silhouette's measured
 * width at every row, for that specific gender and body build. Pre-composited at full canvas
 * size/position, so CharacterSprite renders it full-bleed exactly like BODY/HAIR instead of
 * fitting it into a percentage box (see the Abschlussbericht for why the old icon-in-a-box
 * approach always left a gap). HELMET doesn't vary by build since the head silhouette doesn't
 * change between builds (see BUILD_PROFILES in generate-bodies.ts, which pins the head rows at
 * multiplier 1 for every build). */
export function armorOverlaySrc(
  slot: Exclude<EquipmentSlot, "WEAPON">,
  rarity: ItemRarity,
  gender: HeroCharacterTypeLower,
  bodyBuild: BodyBuildKey,
  armorSetKey?: string | null,
  legendaryStyle?: string | null
): string {
  const setKey = resolveArmorSetKey(rarity, armorSetKey, legendaryStyle);
  if (slot === "HELMET") return `/hero/armor-sets/${setKey}/overlay/helmet/${gender}.png`;
  return `/hero/armor-sets/${setKey}/overlay/${ARMOR_SLOT_DIR[slot]}/${gender}/${bodyBuild}.png`;
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

/** Small hand sprite drawn over a weapon's hilt (see scripts/hero-art/generate-hand-grips.ts and
 * GRIP_ZONES in hero-render-config.ts) so an equipped weapon reads as actually held rather than
 * floating next to the body. Skin-tone matched, not armor-set dependent -- gauntlets are already
 * part of the CHEST overlay art. */
export function handGripSrc(gender: HeroCharacterTypeLower, skinTone: SkinToneKey): string {
  return `/hero/hand-grips/${gender}/${skinTone}.png`;
}
