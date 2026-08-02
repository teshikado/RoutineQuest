import Image from "next/image";
import type { PetSpecies } from "@prisma/client";
import { petSpriteSrc } from "@/lib/hero-assets";

export function PetSprite({ species, stage, className, title }: { species: PetSpecies; stage: 1 | 2 | 3 | 4; className?: string; title?: string }) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Image
        src={petSpriteSrc(species, stage)}
        alt={title ?? ""}
        fill
        sizes="200px"
        className="object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
