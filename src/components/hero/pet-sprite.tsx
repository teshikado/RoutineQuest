import Image from "next/image";
import type { PetSpecies } from "@prisma/client";
import { petSpriteSrc } from "@/lib/hero-assets";

/** `withPodium` adds a soft radial glow and a ground-contact ellipse behind the sprite --
 * the pet art itself has decent contrast, but sitting directly on the page's near-black
 * background made it read as flat/washed-out (no separation from the surrounding void). Only
 * used for the larger, prominent displays (pet panel, beside the character); the small
 * species-picker grid stays plain since a glow per icon there would be visual noise. */
export function PetSprite({
  species,
  stage,
  className,
  title,
  withPodium = false,
}: {
  species: PetSpecies;
  stage: 1 | 2 | 3 | 4;
  className?: string;
  title?: string;
  withPodium?: boolean;
}) {
  if (!withPodium) {
    return (
      <div className={`relative ${className ?? ""}`}>
        <Image src={petSpriteSrc(species, stage)} alt={title ?? ""} fill sizes="200px" className="object-contain" style={{ imageRendering: "pixelated" }} />
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle at 50% 60%, rgba(168,85,247,0.22), transparent 68%)" }}
      />
      <div className="absolute left-1/2 bottom-[6%] h-[14%] w-[62%] -translate-x-1/2 rounded-[50%] bg-black/40 blur-[3px]" />
      <Image
        src={petSpriteSrc(species, stage)}
        alt={title ?? ""}
        fill
        sizes="200px"
        className="object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
