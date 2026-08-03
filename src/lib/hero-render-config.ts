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

/** Every layer is a full-bleed (0/0/100%/100%) image except armor/weapons, which use their own
 * Zone below. Order matters: later entries paint over earlier ones. */
export const LAYER_ORDER: ("BODY" | "HAIR" | EquipmentSlot)[] = ["BODY", "SHOES", "PANTS", "CHEST", "HAIR", "HELMET", "WEAPON"];

export type Zone = { top: string; left: string; width: string; height: string };

export const FULL_BLEED_ZONE: Zone = { top: "0%", left: "0%", width: "100%", height: "100%" };

/** Where each armor item's own art is overlaid on the base character, as a percentage box of
 * the character's frame -- measured directly against the base sprite's body landmarks (head
 * ends ~41% down, torso/waist ~41-61%, hips-to-ankle ~56-88%, feet ~84-97%).
 *
 * CHEST/PANTS/SHOES height was widened from the original zones in this pass -- every armor-set
 * icon (chest/pants/shoes across all 12 sets) is a *portrait*-oriented crop (width:height ratio
 * roughly 0.6-0.95), but the old zone boxes were *landscape* (wider than tall). Since the art is
 * placed with `object-contain` (preserve aspect ratio, fit within the box), a landscape box
 * around portrait art is always height-constrained: the icon renders at whatever width its own
 * aspect ratio implies at that height, leaving the rest of the box's width as empty transparent
 * margin -- which is what actually caused the "armor doesn't reach the shoulders/sides, bare
 * skin gap on both flanks" look reported across every body build (not particular to one, since
 * the geometry mismatch is the same for all of them; wider builds only made the *already
 * present* gap more visible). CHEST's zone box is now close to the icon's own aspect ratio,
 * verified by direct pixel composition (not just visual guessing) against sky-warden on the
 * dünn/kräftig/stabil builds -- see the Abschlussbericht. PANTS/SHOES were widened by the same
 * logic but are capped by how much vertical room exists before hitting the neighboring zone
 * (waist/knee for pants, the canvas bottom for shoes), so a smaller residual gap remains on the
 * widest builds -- fully closing it would need the icon art itself redrawn wider, which is out
 * of scope (see Abschlussbericht for that boundary). */
export const ARMOR_ZONES: Record<Exclude<EquipmentSlot, "WEAPON">, Zone> = {
  HELMET: { top: "3%", left: "19%", width: "62%", height: "33%" },
  CHEST: { top: "27%", left: "11%", width: "78%", height: "50%" },
  PANTS: { top: "55%", left: "19%", width: "62%", height: "36%" },
  SHOES: { top: "81%", left: "23%", width: "54%", height: "18%" },
};

/** Weapon zones are keyed by type (not a single shared box) since their natural art aspect
 * ratios vary hugely, and are anchored near where the character's hand hangs at its side
 * (~72% across, ~58% down) so the hilt reads as gripped rather than the blade floating in
 * empty space beside the body. */
export const WEAPON_ZONES: Record<WeaponType, Zone> = {
  KATANA: { top: "40%", left: "52%", width: "56%", height: "32%" },
  SWORD: { top: "30%", left: "60%", width: "42%", height: "50%" },
  DAGGER: { top: "40%", left: "62%", width: "36%", height: "32%" },
  GREATSWORD: { top: "20%", left: "56%", width: "50%", height: "58%" },
  SPEAR: { top: "8%", left: "54%", width: "48%", height: "80%" },
};

export function zoneFor(slot: EquipmentSlot, weaponType: WeaponType | null): Zone {
  if (slot === "WEAPON") return WEAPON_ZONES[weaponType ?? "SWORD"];
  return ARMOR_ZONES[slot];
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
