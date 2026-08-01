"use client";

import { useState } from "react";
import type { PetSpecies } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PET_SPECIES_META, PET_SPECIES_ORDER, PET_STAGE_META, petStageForLevel } from "@/lib/hero-constants";
import { PetSprite } from "./pet-sprite";
import type { HeroPet } from "./hero-types";

const STAT_LABELS: Record<string, string> = {
  strength: "Stärke",
  speed: "Geschwindigkeit",
  crit: "Kritische Trefferchance",
  defense: "Verteidigung",
  health: "Leben",
  dodge: "Ausweichen",
};

export function PetPanel({
  pet,
  level,
  stage,
  petBonus,
  onSelect,
}: {
  pet: HeroPet | null;
  level: number;
  stage: 1 | 2 | 3 | 4 | null;
  petBonus: number;
  onSelect: (species: PetSpecies) => Promise<void>;
}) {
  const [previewSpecies, setPreviewSpecies] = useState<PetSpecies>(PET_SPECIES_ORDER[0]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);

  if (pet && stage) {
    const meta = PET_SPECIES_META[pet.species];
    return (
      <Card>
        <h2 className="font-bold text-[#F8F7FC] mb-4">Haustier</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <PetSprite species={pet.species} stage={stage} className="w-40 h-32 shrink-0" title={`${meta.label}, Stufe ${stage}`} />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-extrabold text-[#F8F7FC]">{meta.label}</h3>
              <span className="text-xs font-semibold text-[#A855F7] bg-[#A855F7]/15 rounded-full px-2 py-0.5">
                {PET_STAGE_META[stage].label}
              </span>
            </div>
            <p className="text-sm text-[#C8C5D2]">{meta.description}</p>
            <p className="text-xs text-[#8D8998]">Spezialisierung: {meta.specialization}</p>
            <p className="text-sm font-semibold text-[#34D399]">+{petBonus} Heldenstärke durch dein Haustier</p>
            {stage < 4 && (
              <p className="text-xs text-[#8D8998]">
                Nächste Entwicklung ab Level {PET_STAGE_META[((stage + 1) as 2 | 3 | 4)].levelRequirement}.
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  const meta = PET_SPECIES_META[previewSpecies];

  return (
    <Card>
      <h2 className="font-bold text-[#F8F7FC] mb-1">Haustier auswählen</h2>
      <p className="text-xs text-[#C8C5D2] mb-4">
        Wähle genau ein Haustier, das dich dauerhaft begleitet. Jedes Tier entwickelt sich mit deinem Level und gibt einen eigenen
        Bonus auf deine Heldenstärke.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 mb-4">
        <PetSprite species={previewSpecies} stage={petStageForLevel(level)} className="w-40 h-32 mx-auto sm:mx-0" title={meta.label} />
        <div className="space-y-1.5">
          <h3 className="text-lg font-extrabold text-[#F8F7FC]">{meta.label}</h3>
          <p className="text-sm text-[#C8C5D2]">{meta.description}</p>
          <p className="text-xs text-[#8D8998]">Spezialisierung: {meta.specialization}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(meta.statFocus).map(([key, val]) => (
              <span key={key} className="text-[11px] font-semibold text-[#C8C5D2] bg-[#171720] border border-[#292936] rounded-full px-2 py-0.5">
                {STAT_LABELS[key]} {Math.round((val ?? 0) * 100)}%
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-4">
        {PET_SPECIES_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPreviewSpecies(s)}
            aria-pressed={previewSpecies === s}
            aria-label={`${PET_SPECIES_META[s].label} als Vorschau ansehen`}
            className={`rounded-xl border p-2 transition-colors ${
              previewSpecies === s ? "border-[#A855F7] bg-[#A855F7]/10" : "border-[#292936] hover:border-[#3D2A5C]"
            }`}
          >
            <PetSprite species={s} stage={1} className="w-full h-10" title={PET_SPECIES_META[s].label} />
            <div className="text-[10px] font-semibold text-[#C8C5D2] mt-1 truncate">{PET_SPECIES_META[s].label}</div>
          </button>
        ))}
      </div>

      <Button onClick={() => setConfirmOpen(true)}>Dieses Haustier wählen</Button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setSelecting(true);
          try {
            await onSelect(previewSpecies);
            setConfirmOpen(false);
          } finally {
            setSelecting(false);
          }
        }}
        title="Haustier bestätigen"
        description={`Möchtest du wirklich ${meta.label} als Haustier wählen? Diese Wahl ist dauerhaft.`}
        confirmLabel="Bestätigen"
        danger={false}
        loading={selecting}
      />
    </Card>
  );
}
