"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import type { EquipmentSlot, ItemRarity, WeaponType } from "@prisma/client";
import { RARITY_META } from "@/lib/hero-constants";
import { PixelCanvas, type PixelBlock } from "./pixel-canvas";

export type CharacterAppearance = {
  skinTone: string;
  hairStyle: "short" | "long" | "mohawk" | "bald" | "curly";
  hairColor: string;
  eyeColor: string;
};

export type EquippedPiece = { slot: EquipmentSlot; rarity: ItemRarity; weaponType: WeaponType | null };

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const COLS = 16;
const ROWS = 22;

const DEFAULT_SHIRT = "#3A3A46";
const DEFAULT_SHORTS = "#22222C";

function hairBlocks(style: CharacterAppearance["hairStyle"], color: string): PixelBlock[] {
  if (style === "bald") return [];
  const dark = shade(color, -40);
  if (style === "short") {
    return [
      { x: 4.5, y: 1, w: 7, h: 2, fill: color },
      { x: 4.2, y: 2, w: 1, h: 2, fill: color },
      { x: 10.8, y: 2, w: 1, h: 2, fill: color },
    ];
  }
  if (style === "long") {
    return [
      { x: 4.5, y: 1, w: 7, h: 2, fill: color },
      { x: 4, y: 2, w: 1.4, h: 6, fill: color },
      { x: 10.6, y: 2, w: 1.4, h: 6, fill: color },
      { x: 4, y: 7.4, w: 1.4, h: 1, fill: dark },
      { x: 10.6, y: 7.4, w: 1.4, h: 1, fill: dark },
    ];
  }
  if (style === "mohawk") {
    return [
      { x: 6.8, y: -0.6, w: 2.4, h: 2.4, fill: color },
      { x: 4.6, y: 2.4, w: 1, h: 1, fill: color },
      { x: 10.4, y: 2.4, w: 1, h: 1, fill: color },
    ];
  }
  // curly
  return [
    { x: 4.2, y: 0.6, w: 2, h: 2, fill: color },
    { x: 6.2, y: 0.2, w: 2, h: 2.2, fill: dark },
    { x: 8.2, y: 0.2, w: 2, h: 2.2, fill: color },
    { x: 10.2, y: 0.6, w: 2, h: 2, fill: dark },
  ];
}

function rarityDetailLevel(rarity: ItemRarity): 0 | 1 | 2 | 3 {
  return { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3 }[rarity] as 0 | 1 | 2 | 3;
}

function helmetOverlay(rarity: ItemRarity): PixelBlock[] {
  const color = RARITY_META[rarity].color;
  const dark = shade(color, -60);
  const light = shade(color, 60);
  const detail = rarityDetailLevel(rarity);
  const blocks: PixelBlock[] = [
    { x: 4, y: 0.6, w: 8, h: 4.6, fill: color },
    { x: 3.6, y: 4.6, w: 8.8, h: 1.2, fill: dark },
  ];
  if (detail >= 1) blocks.push({ x: 4, y: 1.6, w: 8, h: 0.6, fill: light, opacity: 0.6 });
  if (detail >= 2) blocks.push({ x: 7.2, y: -0.4, w: 1.6, h: 1.4, fill: light });
  if (detail >= 3) blocks.push({ x: 5.5, y: -0.6, w: 5, h: 0.8, fill: RARITY_META.LEGENDARY.color });
  return blocks;
}

function chestOverlay(rarity: ItemRarity): PixelBlock[] {
  const color = RARITY_META[rarity].color;
  const dark = shade(color, -60);
  const light = shade(color, 60);
  const detail = rarityDetailLevel(rarity);
  const blocks: PixelBlock[] = [
    { x: 3, y: 7, w: 10, h: 6, fill: color },
    { x: 2.3, y: 7, w: 1.4, h: 2.6, fill: dark },
    { x: 12.3, y: 7, w: 1.4, h: 2.6, fill: dark },
  ];
  if (detail >= 1) blocks.push({ x: 4, y: 10.4, w: 8, h: 0.6, fill: dark, opacity: 0.7 });
  if (detail >= 2) blocks.push({ x: 6.8, y: 8.6, w: 2.4, h: 2.2, fill: light });
  if (detail >= 3) blocks.push({ x: 3, y: 7.2, w: 10, h: 0.5, fill: RARITY_META.LEGENDARY.color, opacity: 0.9 });
  return blocks;
}

function pantsOverlay(rarity: ItemRarity): PixelBlock[] {
  const color = RARITY_META[rarity].color;
  const dark = shade(color, -60);
  const detail = rarityDetailLevel(rarity);
  const blocks: PixelBlock[] = [
    { x: 3, y: 13, w: 4, h: 5, fill: color },
    { x: 9, y: 13, w: 4, h: 5, fill: color },
    { x: 3, y: 12.6, w: 10, h: 0.8, fill: dark, opacity: 0.7 },
  ];
  if (detail >= 2) {
    blocks.push({ x: 3.4, y: 15, w: 3.2, h: 0.5, fill: shade(color, 60), opacity: 0.6 });
    blocks.push({ x: 9.4, y: 15, w: 3.2, h: 0.5, fill: shade(color, 60), opacity: 0.6 });
  }
  return blocks;
}

function shoesOverlay(rarity: ItemRarity): PixelBlock[] {
  const color = RARITY_META[rarity].color;
  const dark = shade(color, -60);
  return [
    { x: 2.6, y: 18, w: 4, h: 1.8, fill: color },
    { x: 9.4, y: 18, w: 4, h: 1.8, fill: color },
    { x: 2.6, y: 19.2, w: 4, h: 0.6, fill: dark },
    { x: 9.4, y: 19.2, w: 4, h: 0.6, fill: dark },
  ];
}

function weaponOverlay(rarity: ItemRarity, weaponType: WeaponType | null): PixelBlock[] {
  const color = RARITY_META[rarity].color;
  const dark = shade(color, -70);
  const steel = "#C8C5D2";
  const lengths: Record<WeaponType, number> = { DAGGER: 4, KATANA: 8, SWORD: 7, SPEAR: 10, GREATSWORD: 9 };
  const len = lengths[weaponType ?? "SWORD"];
  const blocks: PixelBlock[] = [
    { x: 14.4, y: 15 - len, w: 1.6, h: len, fill: weaponType === "SPEAR" ? dark : steel },
    { x: 14, y: 15, w: 2.4, h: 1, fill: color },
    { x: 14.2, y: 16, w: 2, h: 2.4, fill: dark },
  ];
  if (rarityDetailLevel(rarity) >= 3) blocks.unshift({ x: 13, y: 15 - len - 1, w: 3.6, h: len + 3, fill: color, opacity: 0.14 });
  return blocks;
}

export function characterSpriteBlocks(
  appearance: CharacterAppearance,
  equipped: Partial<Record<EquipmentSlot, EquippedPiece>>
): PixelBlock[] {
  const blocks: PixelBlock[] = [];
  const skin = appearance.skinTone;

  // Base body (always drawn -- equipment layers over it, and unequipped slots show through
  // as the neutral level-1 starter look).
  blocks.push({ x: 4.4, y: 1.2, w: 7.2, h: 5, fill: skin }); // head
  blocks.push({ x: 6.4, y: 6, w: 3.2, h: 1.2, fill: skin }); // neck
  blocks.push({ x: 4.6, y: 15, w: 3, h: 3, fill: skin }); // left shin (bare unless pants)
  blocks.push({ x: 8.4, y: 15, w: 3, h: 3, fill: skin }); // right shin (bare unless pants)

  const chest = equipped.CHEST;
  blocks.push({
    x: 3,
    y: 7,
    w: 10,
    h: 6,
    fill: chest ? RARITY_META[chest.rarity].color : DEFAULT_SHIRT,
  });
  const pants = equipped.PANTS;
  if (pants) {
    blocks.push(...pantsOverlay(pants.rarity));
  } else {
    // Neutral starting kit: dark short trunks, not full-length trousers.
    blocks.push({ x: 3.4, y: 13, w: 3.4, h: 2, fill: DEFAULT_SHORTS });
    blocks.push({ x: 9.2, y: 13, w: 3.4, h: 2, fill: DEFAULT_SHORTS });
  }

  // Feet
  const shoes = equipped.SHOES;
  if (shoes) {
    blocks.push(...shoesOverlay(shoes.rarity));
  } else {
    blocks.push({ x: 2.6, y: 18.4, w: 4, h: 1.4, fill: shade(skin, -30) });
    blocks.push({ x: 9.4, y: 18.4, w: 4, h: 1.4, fill: shade(skin, -30) });
  }

  // Hair + face (before helmet, so a helmet visually covers it)
  blocks.push(...hairBlocks(appearance.hairStyle, appearance.hairColor));
  blocks.push({ x: 9.6, y: 3.2, w: 1, h: 1, fill: "#F8F7FC" });
  blocks.push({ x: 9.8, y: 3.4, w: 0.6, h: 0.6, fill: appearance.eyeColor });

  // Chest overlay (on top of the plain shirt fill above)
  if (chest) blocks.push(...chestOverlay(chest.rarity));

  // Helmet (covers head/hair)
  const helmet = equipped.HELMET;
  if (helmet) blocks.push(...helmetOverlay(helmet.rarity));

  // Weapon
  const weapon = equipped.WEAPON;
  if (weapon) blocks.push(...weaponOverlay(weapon.rarity, weapon.weaponType));

  return blocks;
}

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
  const blocks = characterSpriteBlocks(appearance, equipped);
  const hasLegendary = Object.values(equipped).some((e) => e?.rarity === "LEGENDARY");

  return (
    <motion.div
      className={clsx("relative", className)}
      animate={reducedMotion ? undefined : { y: [0, -0.5, 0] }}
      transition={reducedMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <PixelCanvas blocks={blocks} cols={COLS} rows={ROWS} title="Dein Held" className="w-full h-full block" />
      {hasLegendary && !reducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 55%, rgba(250,204,21,0.18), transparent 65%)" }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.div>
  );
}
