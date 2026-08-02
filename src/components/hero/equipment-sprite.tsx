import Image from "next/image";
import type { EquipmentSlot, ItemRarity, WeaponType } from "@prisma/client";
import { equipmentIconSrc } from "@/lib/hero-assets";

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
  return (
    <div className={`relative ${className ?? ""}`}>
      <Image
        src={equipmentIconSrc(slot, weaponType, rarity)}
        alt={title ?? ""}
        fill
        sizes="160px"
        className="object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
