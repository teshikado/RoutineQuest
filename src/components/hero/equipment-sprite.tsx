import Image from "next/image";
import type { EquipmentSlot, ItemRarity, WeaponType } from "@prisma/client";
import { equipmentIconSrc } from "@/lib/hero-assets";

export function EquipmentSprite({
  slot,
  weaponType,
  rarity,
  armorSetKey,
  className,
  title,
}: {
  slot: EquipmentSlot;
  weaponType: WeaponType | null;
  rarity: ItemRarity;
  armorSetKey?: string | null;
  className?: string;
  title?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Image
        src={equipmentIconSrc(slot, weaponType, rarity, armorSetKey)}
        alt={title ?? ""}
        fill
        sizes="160px"
        className="object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
