"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterSprite, type EquippedPiece } from "./character-sprite";
import {
  BODY_BUILD_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SKIN_TONE_OPTIONS,
  type BodyBuildKey,
  type HairColorKey,
  type HairStyleKey,
  type SkinToneKey,
} from "@/lib/hero-assets";
import type { EquipmentSlot, HeroCharacterType } from "@prisma/client";
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
  equippedForPreview,
  onComplete,
  onCancel,
}: {
  isLegacyWelcome: boolean;
  isAppearanceUpgradeOnly: boolean;
  isEditMode?: boolean;
  level: number;
  equippedForPreview?: Partial<Record<EquipmentSlot, EquippedPiece>>;
  initial?: {
    heroName: string;
    characterType: HeroCharacterType;
    skinTone: SkinToneKey;
    hairColor: HairColorKey;
    hairStyle: HairStyleKey;
    bodyBuild: BodyBuildKey;
  };
  onComplete: (input: {
    heroName: string;
    characterType: HeroCharacterType;
    skinTone: SkinToneKey;
    hairColor: HairColorKey;
    hairStyle: HairStyleKey;
    bodyBuild: BodyBuildKey;
  }) => Promise<void>;
  onCancel?: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [heroName, setHeroName] = useState(initial?.heroName ?? "");
  const [characterType, setCharacterType] = useState<HeroCharacterType>(initial?.characterType ?? "MALE");
  const [skinTone, setSkinTone] = useState<SkinToneKey>(initial?.skinTone ?? "medium");
  const [hairColor, setHairColor] = useState<HairColorKey>(initial?.hairColor ?? "brown");
  const [hairStyle, setHairStyle] = useState<HairStyleKey>(initial?.hairStyle ?? "short-classic");
  const [bodyBuild, setBodyBuild] = useState<BodyBuildKey>(initial?.bodyBuild ?? "normal");
  const [saving, setSaving] = useState(false);
  const [hairFilter, setHairFilter] = useState<"alle" | "kurz" | "lang">("alle");
  const hasEquipped = !!equippedForPreview && Object.keys(equippedForPreview).length > 0;
  const [showArmorPreview, setShowArmorPreview] = useState(false);

  const visibleHairStyles = useMemo(
    () => (hairFilter === "alle" ? HAIR_STYLE_OPTIONS : HAIR_STYLE_OPTIONS.filter((o) => o.category === hairFilter)),
    [hairFilter]
  );

  const dirty = !!initial && (
    heroName !== initial.heroName ||
    characterType !== initial.characterType ||
    skinTone !== initial.skinTone ||
    hairColor !== initial.hairColor ||
    hairStyle !== initial.hairStyle ||
    bodyBuild !== initial.bodyBuild
  );

  function handleReset() {
    if (!initial) return;
    setHeroName(initial.heroName);
    setCharacterType(initial.characterType);
    setSkinTone(initial.skinTone);
    setHairColor(initial.hairColor);
    setHairStyle(initial.hairStyle);
    setBodyBuild(initial.bodyBuild);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await onComplete({ heroName: heroName.trim(), characterType, skinTone, hairColor, hairStyle, bodyBuild });
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
          <div className="flex flex-col items-center sm:items-start gap-2 sm:sticky sm:top-0 sm:self-start">
            <CharacterSprite
              appearance={{ characterType, skinTone, hairColor, hairStyle, bodyBuild }}
              equipped={showArmorPreview ? equippedForPreview ?? {} : {}}
              reducedMotion={reducedMotion}
              className="w-36 h-48 sm:w-40 sm:h-56"
            />
            {hasEquipped && (
              <div className="flex gap-1 rounded-lg bg-[#171720] border border-[#292936] p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setShowArmorPreview(false)}
                  aria-pressed={!showArmorPreview}
                  className={`px-2.5 py-1 rounded-md transition-colors ${!showArmorPreview ? "bg-[#A855F7] text-white" : "text-[#8D8998] hover:text-[#C8C5D2]"}`}
                >
                  Ohne Rüstung
                </button>
                <button
                  type="button"
                  onClick={() => setShowArmorPreview(true)}
                  aria-pressed={showArmorPreview}
                  className={`px-2.5 py-1 rounded-md transition-colors ${showArmorPreview ? "bg-[#A855F7] text-white" : "text-[#8D8998] hover:text-[#C8C5D2]"}`}
                >
                  Mit Rüstung
                </button>
              </div>
            )}
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

            <fieldset>
              <div className="flex items-center justify-between mb-1.5">
                <legend className="text-xs font-semibold text-[#C8C5D2]">Frisur</legend>
                <div className="flex gap-1 rounded-lg bg-[#171720] border border-[#292936] p-0.5 text-[10px] font-semibold">
                  {(["alle", "kurz", "lang"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setHairFilter(f)}
                      aria-pressed={hairFilter === f}
                      className={`px-2 py-0.5 rounded-md transition-colors ${hairFilter === f ? "bg-[#A855F7] text-white" : "text-[#8D8998] hover:text-[#C8C5D2]"}`}
                    >
                      {f === "alle" ? "Alle" : f === "kurz" ? "Kurz" : "Lang"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {visibleHairStyles.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setHairStyle(opt.key)}
                    aria-pressed={hairStyle === opt.key}
                    className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                      hairStyle === opt.key
                        ? "border-[#A855F7] bg-[#A855F7]/10 text-[#D8B4FE]"
                        : "border-[#292936] text-[#C8C5D2] hover:border-[#3D2A5C]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold text-[#C8C5D2] mb-1.5">Körperstatur</legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BODY_BUILD_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setBodyBuild(opt.key)}
                    aria-pressed={bodyBuild === opt.key}
                    title={opt.description}
                    className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors text-left ${
                      bodyBuild === opt.key
                        ? "border-[#A855F7] bg-[#A855F7]/10 text-[#D8B4FE]"
                        : "border-[#292936] text-[#C8C5D2] hover:border-[#3D2A5C]"
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-[10px] font-normal text-[#8D8998]">{opt.description}</div>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          {initial && dirty && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="mr-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[#8D8998] hover:text-[#C8C5D2] transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Zurücksetzen
            </button>
          )}
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
