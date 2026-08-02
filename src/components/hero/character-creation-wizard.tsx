"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterSprite } from "./character-sprite";
import { HAIR_COLOR_OPTIONS, SKIN_TONE_OPTIONS, type HairColorKey, type SkinToneKey } from "@/lib/hero-assets";
import type { HeroCharacterType } from "@prisma/client";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

/** First-time setup: appearance only -- level-1 starter kit (no armor, no weapon) is
 * enforced simply by never passing any `equipped` pieces to the preview here. Pet selection
 * is a separate, independent step reachable right after (see hero-client.tsx). Also reused
 * for accounts that already had a hero before character types existed (`upgradeMode`), in
 * which case only the wording changes -- their items/pet/strength/rewards are untouched. */
export function CharacterCreationWizard({
  isLegacyWelcome,
  isAppearanceUpgradeOnly,
  isEditMode = false,
  level,
  initial,
  onComplete,
  onCancel,
}: {
  isLegacyWelcome: boolean;
  isAppearanceUpgradeOnly: boolean;
  isEditMode?: boolean;
  level: number;
  initial?: { heroName: string; characterType: HeroCharacterType; skinTone: SkinToneKey; hairColor: HairColorKey };
  onComplete: (input: { heroName: string; characterType: HeroCharacterType; skinTone: SkinToneKey; hairColor: HairColorKey }) => Promise<void>;
  onCancel?: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [heroName, setHeroName] = useState(initial?.heroName ?? "");
  const [characterType, setCharacterType] = useState<HeroCharacterType>(initial?.characterType ?? "MALE");
  const [skinTone, setSkinTone] = useState<SkinToneKey>(initial?.skinTone ?? "medium");
  const [hairColor, setHairColor] = useState<HairColorKey>(initial?.hairColor ?? "brown");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await onComplete({ heroName: heroName.trim(), characterType, skinTone, hairColor });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050507]/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl my-8 rounded-2xl border border-[#292936] bg-[#111118] p-6 shadow-[var(--shadow-purple-lg)]">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-[#A855F7]" />
          <h1 className="text-xl font-extrabold text-[#F8F7FC]">
            {isEditMode
              ? "Charakterdarstellung ändern"
              : isAppearanceUpgradeOnly
                ? "Wähle das Aussehen deines Helden"
                : isLegacyWelcome
                  ? "Das Heldensystem ist da!"
                  : "Erschaffe deinen Helden"}
          </h1>
        </div>
        {isEditMode ? (
          <p className="text-sm text-[#C8C5D2] mb-5">
            Ändert nur die Grafik. Level, XP, Gegenstände, Ausrüstung, Stärke, Haustier, Fleisch und Belohnungen bleiben unverändert.
          </p>
        ) : isAppearanceUpgradeOnly ? (
          <p className="text-sm text-[#C8C5D2] mb-5">
            Entscheide dich für eine männliche oder weibliche Charakterdarstellung. Deine Ausrüstung, dein Inventar, dein Haustier,
            deine Stärke und deine Belohnungen bleiben vollständig erhalten.
          </p>
        ) : isLegacyWelcome ? (
          <p className="text-sm text-[#C8C5D2] mb-5">
            Du bist bereits Level {level}. Deshalb warten {level} Ausrüstungsbelohnungen auf dich. Gestalte zuerst dein Aussehen, dann
            kannst du dein Haustier wählen und deine Belohnungen öffnen.
          </p>
        ) : (
          <p className="text-sm text-[#C8C5D2] mb-5">
            Gestalte dein Aussehen. Du startest ohne Rüstung -- deine erste Belohnung wartet schon auf Level 1.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6">
          <div className="flex justify-center sm:justify-start">
            <CharacterSprite appearance={{ characterType, skinTone, hairColor }} equipped={{}} reducedMotion={reducedMotion} className="w-36 h-48 sm:w-40 sm:h-56" />
          </div>

          <div className="space-y-4">
            <fieldset>
              <legend className="text-xs font-semibold text-[#C8C5D2] mb-1.5">Charaktertyp</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["MALE", "FEMALE"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCharacterType(type)}
                    aria-pressed={characterType === type}
                    className={`relative rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                      characterType === type
                        ? "border-[#A855F7] bg-[#A855F7]/10 text-[#D8B4FE] shadow-[0_0_16px_rgba(168,85,247,0.35)]"
                        : "border-[#292936] text-[#C8C5D2] hover:border-[#3D2A5C]"
                    }`}
                  >
                    {characterType === type && <Check className="h-3.5 w-3.5 absolute top-2 right-2" />}
                    {type === "MALE" ? "Männlicher Held" : "Weibliche Heldin"}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="hero-name" className="block text-xs font-semibold text-[#C8C5D2] mb-1.5">
                Name deines Helden (optional)
              </label>
              <input
                id="hero-name"
                type="text"
                value={heroName}
                onChange={(e) => setHeroName(e.target.value)}
                maxLength={24}
                placeholder="z. B. Nachtklinge"
                className="w-full rounded-lg bg-[#171720] border border-[#292936] px-3 py-2 text-sm text-[#F8F7FC] placeholder:text-[#5F5B68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]"
              />
            </div>

            <fieldset>
              <legend className="text-xs font-semibold text-[#C8C5D2] mb-1.5">Hautfarbe</legend>
              <div className="flex gap-2 flex-wrap">
                {SKIN_TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSkinTone(opt.key)}
                    aria-label={`Hautfarbe ${opt.label} wählen`}
                    aria-pressed={skinTone === opt.key}
                    title={opt.label}
                    style={{ backgroundColor: opt.swatch }}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${skinTone === opt.key ? "border-[#A855F7] scale-110" : "border-[#292936]"}`}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold text-[#C8C5D2] mb-1.5">Haarfarbe</legend>
              <div className="flex gap-2 flex-wrap">
                {HAIR_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setHairColor(opt.key)}
                    aria-label={`Haarfarbe ${opt.label} wählen`}
                    aria-pressed={hairColor === opt.key}
                    title={opt.label}
                    style={{ backgroundColor: opt.swatch }}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${hairColor === opt.key ? "border-[#A855F7] scale-110" : "border-[#292936]"}`}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={saving}>
              Abbrechen
            </Button>
          )}
          <Button onClick={handleSubmit} loading={saving}>
            {isEditMode || isAppearanceUpgradeOnly ? "Aussehen speichern" : "Helden erschaffen"}
          </Button>
        </div>
      </div>
    </div>
  );
}
