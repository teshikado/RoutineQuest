"use client";

import Image from "next/image";
import clsx from "clsx";
import { motion } from "framer-motion";
import type { EquipmentSlot, HeroCharacterType, ItemRarity, WeaponType } from "@prisma/client";
import { RARITY_META } from "@/lib/hero-constants";
import { characterVariantSrc, equipmentIconSrc, type HairColorKey, type HairStyleKey, type SkinToneKey } from "@/lib/hero-assets";

export type CharacterAppearance = { characterType: HeroCharacterType; skinTone: SkinToneKey; hairColor: HairColorKey; hairStyle: HairStyleKey };
export type EquippedPiece = { slot: EquipmentSlot; rarity: ItemRarity; weaponType: WeaponType | null };

type Zone = { top: string; left: string; width: string; height: string };

/** Where each armor item's own art is overlaid on the base character, as a percentage box of
 * the character's frame -- measured directly against the base sprite's body landmarks (head
 * ends ~41% down, torso/waist ~41-61%, hips-to-ankle ~56-88%, feet ~84-97%; see the
 * Abschlussbericht for the row-opacity measurement this came from). The armor art itself is
 * already body-shaped (shoulder pads, thigh guards, etc.), not a flat icon, so anchoring the
 * box tightly to the real body region is what makes it read as worn rather than glued on. */
const ARMOR_ZONES: Record<Exclude<EquipmentSlot, "WEAPON">, Zone> = {
  HELMET: { top: "3%", left: "19%", width: "62%", height: "33%" },
  CHEST: { top: "33%", left: "9%", width: "82%", height: "32%" },
  PANTS: { top: "56%", left: "19%", width: "62%", height: "31%" },
  SHOES: { top: "83%", left: "23%", width: "54%", height: "15%" },
};

/** Weapon zones are keyed by type (not a single shared box) since their natural art aspect
 * ratios vary hugely -- a katana is drawn almost flat/horizontal (~2:1) while a spear spans
 * nearly the full figure height (~1:1.6) -- and are anchored near where the character's hand
 * hangs at its side (~72% across, ~58% down) so the hilt reads as gripped rather than the
 * blade floating in empty space beside the body. */
const WEAPON_ZONES: Record<WeaponType, Zone> = {
  KATANA: { top: "40%", left: "52%", width: "56%", height: "32%" },
  SWORD: { top: "30%", left: "60%", width: "42%", height: "50%" },
  DAGGER: { top: "40%", left: "62%", width: "36%", height: "32%" },
  GREATSWORD: { top: "20%", left: "56%", width: "50%", height: "58%" },
  SPEAR: { top: "8%", left: "54%", width: "48%", height: "80%" },
};

function zoneFor(slot: EquipmentSlot, weaponType: WeaponType | null): Zone {
  if (slot === "WEAPON") return WEAPON_ZONES[weaponType ?? "SWORD"];
  return ARMOR_ZONES[slot];
}

/** Fixed draw order (not object-insertion order) so layering is always correct regardless of
 * which slots happen to be equipped: legs and feet first, the torso piece next (so its hem
 * overlaps the waistband like a tucked-in garment), the helmet above that, and the weapon
 * last so it reads as held in front of the body. */
const LAYER_ORDER: EquipmentSlot[] = ["SHOES", "PANTS", "CHEST", "HELMET", "WEAPON"];

const RARITY_GLOW: Record<ItemRarity, string | null> = {
  COMMON: null,
  RARE: "0 0 14px rgba(56,189,248,0.45)",
  EPIC: "0 0 18px rgba(168,85,247,0.55)",
  LEGENDARY: "0 0 24px rgba(250,204,21,0.6)",
};

export function CharacterSprite({
  appearance,
  equipped,
  reducedMotion,
  className,
}: {
  appearance: CharacterAppearance;
  equipped: Partial<Record<EquipmentSlot, EquippedPiece>>;
  reducedMotion: boolean;
  className?: string;
}) {
  const gender = appearance.characterType === "FEMALE" ? "female" : "male";
  const src = characterVariantSrc(gender, appearance.skinTone, appearance.hairColor, appearance.hairStyle);
  // Only the highest-rarity equipped piece gets an ambient glow behind the whole character,
  // per "verhindere dass mehrere Effekte die Ansicht überladen" -- use the strongest rarity
  // present rather than stacking a glow per item.
  const rarityOrder: ItemRarity[] = ["LEGENDARY", "EPIC", "RARE", "COMMON"];
  const topRarity = rarityOrder.find((r) => Object.values(equipped).some((e) => e?.rarity === r));

  return (
    <motion.div
      className={clsx("relative select-none", className)}
      animate={reducedMotion ? undefined : { y: [0, -3, 0] }}
      transition={reducedMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      {topRarity && topRarity !== "COMMON" && !reducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle at 50% 55%, ${RARITY_META[topRarity].color}33, transparent 65%)` }}
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <Image
        src={src}
        alt={`${gender === "male" ? "Männlicher Held" : "Weibliche Heldin"} in Startkleidung`}
        fill
        sizes="240px"
        className="object-contain"
        style={{ imageRendering: "pixelated" }}
        priority
      />
      {LAYER_ORDER.filter((slot) => equipped[slot]).map((slot) => {
        const item = equipped[slot]!;
        const zone = zoneFor(slot, item.weaponType);
        const glow = RARITY_GLOW[item.rarity];
        return (
          <div
            key={slot}
            className="absolute"
            style={{ top: zone.top, left: zone.left, width: zone.width, height: zone.height, filter: glow ? `drop-shadow(${glow})` : undefined }}
          >
            <Image
              src={equipmentIconSrc(slot, item.weaponType, item.rarity)}
              alt=""
              fill
              sizes="160px"
              className="object-contain"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
        );
      })}
    </motion.div>
  );
}
