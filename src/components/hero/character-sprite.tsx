"use client";

import Image from "next/image";
import clsx from "clsx";
import { motion } from "framer-motion";
import type { EquipmentSlot, HeroCharacterType, ItemRarity, WeaponType } from "@prisma/client";
import { RARITY_META } from "@/lib/hero-constants";
import { characterVariantSrc, equipmentIconSrc, type HairColorKey, type SkinToneKey } from "@/lib/hero-assets";

export type CharacterAppearance = { characterType: HeroCharacterType; skinTone: SkinToneKey; hairColor: HairColorKey };
export type EquippedPiece = { slot: EquipmentSlot; rarity: ItemRarity; weaponType: WeaponType | null };

/** Where each equipped item's icon is overlaid on top of the base character image, as a
 * percentage box of the character's own frame. The base art and the item icons come from
 * two different sources in the provided sheets (a standalone character sprite vs. separate
 * floating item-icon renders) -- true pixel-fused "worn" equipment isn't achievable from
 * that mismatch, so this approximates it by placing each item's own icon over the matching
 * body zone instead. Centralized here (not scattered across components) per the "keep
 * position values central" requirement. */
const OVERLAY_ZONES: Record<EquipmentSlot, { top: string; left: string; width: string; height: string }> = {
  HELMET: { top: "0%", left: "22%", width: "56%", height: "26%" },
  CHEST: { top: "24%", left: "18%", width: "64%", height: "30%" },
  PANTS: { top: "52%", left: "20%", width: "60%", height: "30%" },
  SHOES: { top: "82%", left: "20%", width: "60%", height: "16%" },
  WEAPON: { top: "18%", left: "68%", width: "40%", height: "62%" },
};

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
  const src = characterVariantSrc(gender, appearance.skinTone, appearance.hairColor);
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
      {(Object.entries(equipped) as [EquipmentSlot, EquippedPiece][]).map(([slot, item]) => {
        const zone = OVERLAY_ZONES[slot];
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
