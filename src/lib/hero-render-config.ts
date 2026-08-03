import type { EquipmentSlot, WeaponType } from "@prisma/client";

/** Single source of truth for how the hero character is assembled visually -- canvas layer
 * order, per-slot anchor zones, and body/hair configuration. Everything here was previously
 * scattered between character-sprite.tsx and hero-assets.ts; consolidating it doesn't change
 * any visual output by itself, it just gives the rest of the system one place to look.
 *
 * A note on canvas size: the original brief asked for one unified logical canvas (e.g. 128x160)
 * for every character asset. The actual art this project has is native 171x315 (male) / 163x316
 * (female) pixel sprites with everything else (armor, weapons, hair) anchored to it as *percentage*
 * zones of that frame -- not pixel offsets. Rebuilding the base art at a different native
 * resolution would mean redrawing all existing hand-painted body/armor art from scratch, which
 * is out of reach without an illustration tool (see the Abschlussbericht). The percentage-zone
 * approach achieves the same practical goal (one consistent anchor system all layers share,
 * resolution-independent) without requiring that redraw, so it's kept as the coordinate system
 * here instead of switching to fixed pixel anchors. */

export const CHARACTER_NATIVE_SIZE: Record<"male" | "female", { width: number; height: number }> = {
  male: { width: 171, height: 315 },
  female: { width: 163, height: 316 },
};

/** Every layer is a full-bleed (0/0/100%/100%) image except WEAPON/GRIP, which use their own
 * small Zone below (a weapon is a free-standing object next to the body, not something that
 * needs to conform to its silhouette the way armor does). Order matters: later entries paint
 * over earlier ones. GRIP (the hand sprite drawn over the weapon's hilt) is last so the hand
 * reads as gripping the weapon rather than the weapon floating past a closed fist. */
export const LAYER_ORDER: ("BODY" | "HAIR" | EquipmentSlot | "GRIP")[] = ["BODY", "SHOES", "PANTS", "CHEST", "HAIR", "HELMET", "WEAPON", "GRIP"];

export type Zone = { top: string; left: string; width: string; height: string };

export const FULL_BLEED_ZONE: Zone = { top: "0%", left: "0%", width: "100%", height: "100%" };

/** HELMET/CHEST/PANTS/SHOES used to be a single flat icon fit into a percentage box via
 * `object-contain` -- since the icon art is portrait-oriented and the boxes were not, every
 * build always showed a bare-skin gap on both flanks. That approach is retired: armor is now
 * rendered via `armorOverlaySrc` (hero-assets.ts) -- a full-canvas, per-gender/per-build image
 * where scripts/hero-art/generate-armor-overlays.ts has already reshaped the original icon art
 * row-by-row to match the real body silhouette's measured width, then composited it at the
 * right position -- so CharacterSprite renders it full-bleed exactly like BODY/HAIR instead of
 * fitting it into a box (see the Abschlussbericht).
 *
 * Weapon zones are keyed by type (not a single shared box) since their natural art aspect
 * ratios vary hugely, and are anchored near where the character's hand hangs at its side
 * (~72% across, ~58% down) so the hilt reads as gripped rather than the blade floating in
 * empty space beside the body.
 *
 * Sizes below were widened (dagger shrunk, greatsword/katana/spear grown) from an earlier pass
 * that sized every type's box about the same -- the underlying item-icon art is a set of
 * inventory cards (deliberately normalized to a similar canvas footprint regardless of the
 * weapon's fictional size, same convention as any RPG item-icon grid; measured: trimmed content
 * diagonal ranges only 209-250px across all 5 types), so fitting them into similarly-sized
 * on-body boxes made a dagger and a greatsword read as almost the same size on the character --
 * failing "Dolch deutlich kleiner" / "Großschwert schwer". Each box below keeps its previous
 * center point (so the grip position doesn't shift) but scales its footprint by an explicit
 * factor: dagger x0.7, katana/spear x1.08, greatsword x1.3, sword unchanged -- so the size
 * hierarchy is guaranteed by this config instead of depending on how a given icon happens to
 * be cropped. Actual on-body rendered size (accounting for each icon's own aspect within its
 * box) was verified numerically, not just eyeballed -- see the Abschlussbericht. */
export const WEAPON_ZONES: Record<WeaponType, Zone> = {
  KATANA: { top: "39%", left: "50%", width: "60%", height: "35%" },
  SWORD: { top: "30%", left: "60%", width: "42%", height: "50%" },
  DAGGER: { top: "45%", left: "67%", width: "25%", height: "22%" },
  GREATSWORD: { top: "11%", left: "49%", width: "65%", height: "76%" },
  SPEAR: { top: "5%", left: "52%", width: "52%", height: "86%" },
};

/** Small hand-sprite box drawn over each weapon type's hilt (see hero-assets.ts handGripSrc and
 * scripts/hero-art/generate-hand-grips.ts) -- positioned near the same "hand hangs at the
 * character's side" point the weapon zones themselves are anchored to, with a small per-type
 * nudge so the fist lines up with where that weapon's hilt actually sits within its own zone. */
export const GRIP_ZONES: Record<WeaponType, Zone> = {
  KATANA: { top: "53%", left: "62%", width: "18%", height: "14%" },
  SWORD: { top: "51%", left: "66%", width: "16%", height: "13%" },
  DAGGER: { top: "53%", left: "65%", width: "14%", height: "12%" },
  GREATSWORD: { top: "49%", left: "60%", width: "18%", height: "14%" },
  SPEAR: { top: "51%", left: "62%", width: "16%", height: "13%" },
};

export function zoneFor(slot: EquipmentSlot, weaponType: WeaponType | null): Zone {
  if (slot === "WEAPON") return WEAPON_ZONES[weaponType ?? "SWORD"];
  return FULL_BLEED_ZONE;
}

export function gripZoneFor(weaponType: WeaponType | null): Zone {
  return GRIP_ZONES[weaponType ?? "SWORD"];
}

// ---------- Body builds ----------
// Five real, independently-reshaped silhouettes per gender (see scripts/hero-art/generate-bodies.ts)
// instead of a single base image scaled with CSS transform. Each build is its own PNG under
// public/hero/characters/{gender}/body/{build}/{skin}.png with the hair removed (a separate
// overlay handles hair -- see HAIR_STYLE_META below), reshaped per-row so the head and feet stay
// fixed while shoulders/chest/waist/hips/legs get genuinely different proportions.
export type BodyBuildKey = "duenn" | "normal" | "muskuloes" | "kraeftig" | "stabil";
export const BODY_BUILD_OPTIONS: { key: BodyBuildKey; label: string; description: string }[] = [
  { key: "duenn", label: "Dünn", description: "Schmale Schultern, dünne Arme, schmale Taille -- schlank und leicht." },
  { key: "normal", label: "Normal", description: "Ausgeglichene Proportionen für Schultern, Arme, Taille und Beine." },
  { key: "muskuloes", label: "Muskulös", description: "Breitere Schultern, athletischer Brustkorb, sportlich schmalere Taille." },
  { key: "kraeftig", label: "Kräftig", description: "Sehr breite Schultern, großer Brustkorb, robuste Arme und Beine." },
  { key: "stabil", label: "Stabil", description: "Breiter, runderer Oberkörper mit robusten Armen und breiterer Hüfte." },
];
export const BODY_BUILD_KEY_ORDER: BodyBuildKey[] = BODY_BUILD_OPTIONS.map((o) => o.key);

// ---------- Hairstyles ----------
// Eight real, independently-silhouetted hairstyles rendered as their own overlay layer (see
// scripts/hero-art/generate-hairstyles.ts) instead of being baked into the base body image.
// "short-classic" and "long-straight" are extracted unchanged from the original hand-derived
// art via the pixel-diff hair mask; the other six are new procedural silhouettes.
export type HairStyleKey =
  | "short-classic" | "short-messy" | "short-side-part" | "short-warrior"
  | "long-straight" | "long-side-part" | "long-ponytail" | "long-warrior-braid";

export const HAIR_STYLE_META: Record<HairStyleKey, { label: string; category: "kurz" | "lang" }> = {
  "short-classic": { label: "Klassisch kurz", category: "kurz" },
  "short-messy": { label: "Zerzaust", category: "kurz" },
  "short-side-part": { label: "Seitenscheitel", category: "kurz" },
  "short-warrior": { label: "Krieger-Schnitt", category: "kurz" },
  "long-straight": { label: "Glatt lang", category: "lang" },
  "long-side-part": { label: "Langer Seitenscheitel", category: "lang" },
  "long-ponytail": { label: "Pferdeschwanz", category: "lang" },
  "long-warrior-braid": { label: "Krieger-Zopf", category: "lang" },
};
export const HAIR_STYLE_KEY_ORDER: HairStyleKey[] = [
  "short-classic", "short-messy", "short-side-part", "short-warrior",
  "long-straight", "long-side-part", "long-ponytail", "long-warrior-braid",
];

/** Legacy free-text values ("kurz"/"lang") stored on older HeroProfile rows before this system
 * existed -- mapped once at read time (see hero-service.ts) to a concrete style so every
 * profile always resolves to one of the 8 keys above without a destructive migration. */
export const LEGACY_HAIR_STYLE_MAP: Record<string, HairStyleKey> = {
  kurz: "short-classic",
  lang: "long-straight",
};

export function normalizeHairStyle(value: string | null | undefined): HairStyleKey {
  if (value && value in HAIR_STYLE_META) return value as HairStyleKey;
  if (value && value in LEGACY_HAIR_STYLE_MAP) return LEGACY_HAIR_STYLE_MAP[value];
  return "short-classic";
}

/** Reduced-motion handling lives in CharacterSprite (the `reducedMotion` prop gates the
 * framer-motion idle-bob and glow animations) -- listed here only so this file stays the single
 * index of every render-affecting knob in the system. */
export const REDUCED_MOTION_AFFECTS = ["idle-bob", "rarity-glow-pulse"] as const;
