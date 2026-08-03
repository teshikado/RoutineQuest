"use client";

import Image from "next/image";
import clsx from "clsx";
import { motion } from "framer-motion";
import type { EquipmentSlot, HeroCharacterType, ItemRarity, WeaponType } from "@prisma/client";
import { RARITY_META } from "@/lib/hero-constants";
import {
  characterBodySrc,
  hairOverlaySrc,
  equipmentIconSrc,
  type BodyBuildKey,
  type HairColorKey,
  type SkinToneKey,
} from "@/lib/hero-assets";
import { LAYER_ORDER, FULL_BLEED_ZONE, zoneFor } from "@/lib/hero-render-config";

export type CharacterAppearance = {
  characterType: HeroCharacterType;
  skinTone: SkinToneKey;
  hairColor: HairColorKey;
  hairStyle: string;
  bodyBuild?: BodyBuildKey;
};
export type EquippedPiece = {
  slot: EquipmentSlot;
  rarity: ItemRarity;
  weaponType: WeaponType | null;
  armorSetKey?: string | null;
  legendaryStyle?: string | null;
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
  const build = appearance.bodyBuild ?? "normal";
  const bodySrc = characterBodySrc(gender, build, appearance.skinTone);
  const hairSrc = hairOverlaySrc(gender, appearance.hairStyle, appearance.hairColor);
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
      <div className="absolute inset-0">
        {LAYER_ORDER.map((layer) => {
          if (layer === "BODY") {
            return (
              <Image
                key="body"
                src={bodySrc}
                alt={`${gender === "male" ? "Männlicher Held" : "Weibliche Heldin"} in Startkleidung`}
                fill
                sizes="240px"
                className="object-contain"
                style={{ imageRendering: "pixelated" }}
                priority
              />
            );
          }
          if (layer === "HAIR") {
            return (
              <div key="hair" className="absolute" style={{ top: FULL_BLEED_ZONE.top, left: FULL_BLEED_ZONE.left, width: FULL_BLEED_ZONE.width, height: FULL_BLEED_ZONE.height }}>
                <Image src={hairSrc} alt="" fill sizes="240px" className="object-contain" style={{ imageRendering: "pixelated" }} />
              </div>
            );
          }
          const item = equipped[layer];
          if (!item) return null;
          const zone = zoneFor(layer, item.weaponType);
          const glow = RARITY_GLOW[item.rarity];
          return (
            <div
              key={layer}
              className="absolute"
              style={{ top: zone.top, left: zone.left, width: zone.width, height: zone.height, filter: glow ? `drop-shadow(${glow})` : undefined }}
            >
              <Image
                src={equipmentIconSrc(layer, item.weaponType, item.rarity, item.armorSetKey, item.legendaryStyle)}
                alt=""
                fill
                sizes="160px"
                className="object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
