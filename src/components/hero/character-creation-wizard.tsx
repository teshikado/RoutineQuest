"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterSprite, type CharacterAppearance } from "./character-sprite";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

const SKIN_TONES = ["#F5D5B8", "#E8B48C", "#C68863", "#9C6844", "#6B4530", "#4A2F1F"];
const HAIR_COLORS = ["#1A1A1F", "#3A2A1E", "#6B4226", "#A85C32", "#D4A94C", "#E8E8EC", "#A855F7", "#38BDF8"];
const EYE_COLORS = ["#4A3728", "#2E6B4F", "#2E5B8A", "#5B2E8A", "#111118"];
const HAIR_STYLES: { value: CharacterAppearance["hairStyle"]; label: string }[] = [
  { value: "short", label: "Kurz" },
  { value: "long", label: "Lang" },
  { value: "mohawk", label: "Irokese" },
  { value: "curly", label: "Lockig" },
  { value: "bald", label: "Kahl" },
];

/** First-time setup: appearance only -- level-1 starter kit (no armor, no weapon) is
 * enforced simply by never passing any `equipped` pieces to the preview here. Pet selection
 * is a separate, independent step reachable right after (see hero-client.tsx), so a user
 * can finish this quickly and pick a pet moments later without it blocking here. */
export function CharacterCreationWizard({
  isLegacyWelcome,
  level,
  onComplete,
}: {
  isLegacyWelcome: boolean;
  level: number;
  onComplete: (appearance: CharacterAppearance & { heroName: string }) => Promise<void>;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [heroName, setHeroName] = useState("");
  const [skinTone, setSkinTone] = useState(SKIN_TONES[1]);
  const [hairStyle, setHairStyle] = useState<CharacterAppearance["hairStyle"]>("short");
  const [hairColor, setHairColor] = useState(HAIR_COLORS[1]);
  const [eyeColor, setEyeColor] = useState(EYE_COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await onComplete({ heroName: heroName.trim(), skinTone, hairStyle, hairColor, eyeColor });
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
            {isLegacyWelcome ? "Das Heldensystem ist da!" : "Erschaffe deinen Helden"}
          </h1>
        </div>
        {isLegacyWelcome ? (
          <p className="text-sm text-[#C8C5D2] mb-5">
            Du bist bereits Level {level}. Deshalb warten {level} Ausrüstungsbelohnungen auf dich. Gestalte zuerst dein Aussehen,
            dann kannst du dein Haustier wählen und deine Belohnungen öffnen.
          </p>
        ) : (
          <p className="text-sm text-[#C8C5D2] mb-5">
            Gestalte dein Aussehen. Du startest ohne Rüstung -- deine erste Belohnung wartet schon auf Level 1.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6">
          <div className="flex justify-center sm:justify-start">
            <CharacterSprite
              appearance={{ skinTone, hairStyle, hairColor, eyeColor }}
              equipped={{}}
              reducedMotion={reducedMotion}
              className="w-36 h-48 sm:w-40 sm:h-56"
            />
          </div>

          <div className="space-y-4">
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
                {SKIN_TONES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSkinTone(c)}
                    aria-label={`Hautfarbe ${c} wählen`}
                    aria-pressed={skinTone === c}
                    style={{ backgroundColor: c }}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${skinTone === c ? "border-[#A855F7] scale-110" : "border-[#292936]"}`}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold text-[#C8C5D2] mb-1.5">Frisur</legend>
              <div className="flex gap-1.5 flex-wrap">
                {HAIR_STYLES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setHairStyle(s.value)}
                    aria-pressed={hairStyle === s.value}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
                      hairStyle === s.value ? "border-[#A855F7] bg-[#A855F7]/15 text-[#D8B4FE]" : "border-[#292936] text-[#C8C5D2] hover:border-[#3D2A5C]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold text-[#C8C5D2] mb-1.5">Haarfarbe</legend>
              <div className="flex gap-2 flex-wrap">
                {HAIR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setHairColor(c)}
                    aria-label={`Haarfarbe ${c} wählen`}
                    aria-pressed={hairColor === c}
                    style={{ backgroundColor: c }}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${hairColor === c ? "border-[#A855F7] scale-110" : "border-[#292936]"}`}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold text-[#C8C5D2] mb-1.5">Augenfarbe (optional)</legend>
              <div className="flex gap-2 flex-wrap">
                {EYE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEyeColor(c)}
                    aria-label={`Augenfarbe ${c} wählen`}
                    aria-pressed={eyeColor === c}
                    style={{ backgroundColor: c }}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${eyeColor === c ? "border-[#A855F7] scale-110" : "border-[#292936]"}`}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSubmit} loading={saving}>
            Helden erschaffen
          </Button>
        </div>
      </div>
    </div>
  );
}
