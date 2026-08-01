import type { EquipmentSlot, ItemRarity, WeaponType } from "@prisma/client";
import { RARITY_META } from "@/lib/hero-constants";
import { PixelCanvas, type PixelBlock } from "./pixel-canvas";

/** One fixed silhouette per armor slot / weapon type (hand-authored, not randomized -- see
 * pet-sprite.tsx for the same reasoning), with rarity purely controlling color + how much
 * extra trim/glow/particle detail is layered on top. This is what makes every rarity of the
 * same item type instantly recognizable as "the same kind of item, but better" rather than
 * unrelated pictures. */

function rarityDetailLevel(rarity: ItemRarity): 0 | 1 | 2 | 3 {
  return { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3 }[rarity] as 0 | 1 | 2 | 3;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function armorSilhouette(slot: Exclude<EquipmentSlot, "WEAPON">, rarity: ItemRarity): { blocks: PixelBlock[]; cols: number; rows: number } {
  const cols = 12;
  const rows = 12;
  const color = RARITY_META[rarity].color;
  const dark = shade(color, -60);
  const light = shade(color, 60);
  const detail = rarityDetailLevel(rarity);
  const blocks: PixelBlock[] = [];

  if (slot === "HELMET") {
    blocks.push({ x: 2, y: 5, w: 8, h: 5, fill: color });
    blocks.push({ x: 1, y: 8, w: 10, h: 1.5, fill: dark }); // brim
    blocks.push({ x: 3, y: 2.5, w: 6, h: 3, fill: color });
    blocks.push({ x: 4, y: 2, w: 4, h: 1, fill: light, opacity: 0.7 }); // crown highlight
    if (detail >= 1) blocks.push({ x: 2, y: 6.5, w: 8, h: 0.6, fill: light, opacity: 0.6 });
    if (detail >= 2) blocks.push({ x: 5.5, y: 1, w: 1, h: 1.5, fill: light }); // small plume/spike
    if (detail >= 3) {
      blocks.push({ x: 4.5, y: 0.2, w: 3, h: 1, fill: RARITY_META.LEGENDARY.color });
      blocks.push({ x: 1.5, y: 4.5, w: 9, h: 0.5, fill: light, opacity: 0.9 });
    }
  } else if (slot === "CHEST") {
    blocks.push({ x: 2, y: 2, w: 8, h: 8, fill: color });
    blocks.push({ x: 0.5, y: 2, w: 2, h: 3, fill: dark }); // shoulder pad L
    blocks.push({ x: 9.5, y: 2, w: 2, h: 3, fill: dark }); // shoulder pad R
    blocks.push({ x: 4.5, y: 3, w: 3, h: 1, fill: light, opacity: 0.6 });
    if (detail >= 1) blocks.push({ x: 3, y: 6, w: 6, h: 0.8, fill: dark, opacity: 0.7 }); // belt line
    if (detail >= 2) blocks.push({ x: 5.2, y: 4.5, w: 1.6, h: 1.6, fill: light }); // emblem
    if (detail >= 3) {
      blocks.push({ x: 1, y: 1.2, w: 10, h: 0.6, fill: RARITY_META.LEGENDARY.color, opacity: 0.9 });
      blocks.push({ x: 2, y: 9, w: 8, h: 0.6, fill: light, opacity: 0.8 });
    }
  } else if (slot === "PANTS") {
    blocks.push({ x: 2, y: 1, w: 8, h: 4, fill: color });
    blocks.push({ x: 2, y: 5, w: 3.4, h: 6, fill: color });
    blocks.push({ x: 6.6, y: 5, w: 3.4, h: 6, fill: color });
    blocks.push({ x: 2, y: 4.6, w: 8, h: 0.7, fill: dark, opacity: 0.7 }); // waist line
    if (detail >= 1) {
      blocks.push({ x: 2.2, y: 7, w: 3, h: 0.5, fill: light, opacity: 0.6 });
      blocks.push({ x: 6.8, y: 7, w: 3, h: 0.5, fill: light, opacity: 0.6 });
    }
    if (detail >= 2) blocks.push({ x: 4.3, y: 2, w: 3.4, h: 1, fill: light, opacity: 0.7 });
    if (detail >= 3) blocks.push({ x: 2, y: 1, w: 8, h: 0.6, fill: RARITY_META.LEGENDARY.color });
  } else {
    // SHOES
    blocks.push({ x: 1.5, y: 6, w: 4, h: 4.5, fill: color });
    blocks.push({ x: 6.5, y: 6, w: 4, h: 4.5, fill: color });
    blocks.push({ x: 1.5, y: 9.5, w: 4.6, h: 1.2, fill: dark });
    blocks.push({ x: 6.5, y: 9.5, w: 4.6, h: 1.2, fill: dark });
    if (detail >= 1) {
      blocks.push({ x: 1.8, y: 7, w: 3.4, h: 0.5, fill: light, opacity: 0.7 });
      blocks.push({ x: 6.8, y: 7, w: 3.4, h: 0.5, fill: light, opacity: 0.7 });
    }
    if (detail >= 2) {
      blocks.push({ x: 2.5, y: 6.4, w: 0.7, h: 3, fill: light, opacity: 0.8 });
      blocks.push({ x: 7.5, y: 6.4, w: 0.7, h: 3, fill: light, opacity: 0.8 });
    }
  }

  if (detail >= 2) {
    // Small floating particle dots for epic/legendary.
    blocks.push({ x: 0.2, y: 0.5, w: 0.6, h: 0.6, fill: light, opacity: 0.8 });
    blocks.push({ x: cols - 1, y: 1.5, w: 0.6, h: 0.6, fill: light, opacity: 0.7 });
  }
  if (detail >= 3) {
    blocks.unshift({ x: -0.5, y: -0.5, w: cols + 1, h: rows + 1, fill: color, opacity: 0.12 });
  }

  return { blocks, cols, rows };
}

function weaponSilhouette(weaponType: WeaponType, rarity: ItemRarity): { blocks: PixelBlock[]; cols: number; rows: number } {
  const cols = 14;
  const rows = 12;
  const color = RARITY_META[rarity].color;
  const dark = shade(color, -70);
  const light = shade(color, 70);
  const detail = rarityDetailLevel(rarity);
  const steel = "#C8C5D2";
  const blocks: PixelBlock[] = [];

  // Handle, shared
  const handle = { x: 2, y: 8, w: 1.6, h: 3, fill: dark };
  const guard = { x: 1, y: 7.2, w: 3.6, h: 1, fill: color };

  if (weaponType === "KATANA") {
    blocks.push({ x: 3.5, y: 1, w: 8, h: 1.4, fill: steel });
    for (let i = 0; i < 8; i++) blocks.push({ x: 3.6 + i, y: 1 + i * 0.35, w: 1, h: 1.4 - i * 0.05, fill: steel });
    blocks.push(guard, handle);
  } else if (weaponType === "GREATSWORD") {
    blocks.push({ x: 2.5, y: 0.5, w: 4, h: 7, fill: steel });
    blocks.push({ x: 2.5, y: 0.5, w: 1, h: 7, fill: light, opacity: 0.6 });
    blocks.push({ x: 1.5, y: 7.2, w: 6, h: 1, fill: color });
    blocks.push({ x: 3.5, y: 8.2, w: 2, h: 3.2, fill: dark });
  } else if (weaponType === "DAGGER") {
    blocks.push({ x: 4.5, y: 3.5, w: 2.4, h: 4.5, fill: steel });
    blocks.push(guard, handle);
  } else if (weaponType === "SPEAR") {
    blocks.push({ x: 5.5, y: 0.5, w: 1, h: 10, fill: dark });
    blocks.push({ x: 4.8, y: 0.2, w: 2.4, h: 2, fill: steel });
    blocks.push({ x: 5.5, y: 0.2, w: 1, h: 0.6, fill: light, opacity: 0.7 });
  } else {
    // SWORD
    blocks.push({ x: 4.5, y: 1, w: 2.4, h: 6.5, fill: steel });
    blocks.push({ x: 4.5, y: 1, w: 0.7, h: 6.5, fill: light, opacity: 0.6 });
    blocks.push(guard, handle);
  }

  if (weaponType !== "SPEAR" && weaponType !== "GREATSWORD" && weaponType !== "KATANA") {
    // pommel
    blocks.push({ x: 2, y: 10.6, w: 1.6, h: 1, fill: color });
  }

  if (detail >= 1) blocks.push({ x: 0.5, y: 0.5, w: 0.7, h: 0.7, fill: light, opacity: 0.7 });
  if (detail >= 2) {
    blocks.push({ x: 13, y: 2, w: 0.7, h: 0.7, fill: light, opacity: 0.8 });
    blocks.push({ x: 12, y: 5, w: 0.5, h: 0.5, fill: light, opacity: 0.6 });
  }
  if (detail >= 3) {
    blocks.unshift({ x: -0.5, y: -0.5, w: cols + 1, h: rows + 1, fill: color, opacity: 0.14 });
    blocks.push({ x: 1, y: 6.8, w: 4.2, h: 0.3, fill: RARITY_META.LEGENDARY.color, opacity: 0.9 });
  }

  return { blocks, cols, rows };
}

export function equipmentSpriteData(
  slot: EquipmentSlot,
  weaponType: WeaponType | null,
  rarity: ItemRarity
): { blocks: PixelBlock[]; cols: number; rows: number } {
  if (slot === "WEAPON") return weaponSilhouette(weaponType ?? "SWORD", rarity);
  return armorSilhouette(slot, rarity);
}

export function EquipmentSprite({
  slot,
  weaponType,
  rarity,
  className,
  title,
}: {
  slot: EquipmentSlot;
  weaponType: WeaponType | null;
  rarity: ItemRarity;
  className?: string;
  title?: string;
}) {
  const { blocks, cols, rows } = equipmentSpriteData(slot, weaponType, rarity);
  return <PixelCanvas blocks={blocks} cols={cols} rows={rows} className={className} title={title} />;
}
