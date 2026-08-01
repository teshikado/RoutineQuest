import Link from "next/link";
import { Sword, ChevronRight, Gift } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PET_SPECIES_META } from "@/lib/hero-constants";
import type { PetSpecies } from "@prisma/client";

export type DashboardHeroSummary =
  | { needsCharacterSetup: true; level: number }
  | {
      needsCharacterSetup: false;
      level: number;
      heroStrength: number;
      petSpecies: PetSpecies | null;
      todayMeat: number;
      meatGoal: number;
      pendingRewardCount: number;
    };

/** Small teaser card on the dashboard -- deliberately terse (a handful of numbers + one
 * button) so it doesn't compete with the "Heute" list for attention. */
export function HeroCard({ summary }: { summary: DashboardHeroSummary }) {
  if (summary.needsCharacterSetup) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sword className="h-5 w-5 text-[#A855F7]" />
            <div>
              <div className="font-bold text-[#F8F7FC]">Entdecke deinen Helden</div>
              <div className="text-xs text-[#C8C5D2]">Erschaffe deinen Charakter und sammle Ausrüstung.</div>
            </div>
          </div>
          <Link
            href="/hero"
            className="shrink-0 flex items-center gap-1 text-xs font-semibold text-[#A855F7] hover:text-[#C084FC] rounded-lg px-2 py-1.5 hover:bg-[#171720] transition-colors"
          >
            Held öffnen <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sword className="h-4 w-4 text-[#A855F7]" />
          <span className="font-bold text-[#F8F7FC]">Held – Level {summary.level}</span>
        </div>
        {summary.pendingRewardCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-[#111118] bg-[#FACC15] rounded-full px-2 py-0.5">
            <Gift className="h-3 w-3" /> {summary.pendingRewardCount}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div>
          <div className="text-sm font-extrabold text-[#F8F7FC] tabular-nums">{summary.heroStrength}</div>
          <div className="text-[10px] text-[#8D8998]">Stärke</div>
        </div>
        <div>
          <div className="text-sm font-extrabold text-[#F8F7FC] truncate">{summary.petSpecies ? PET_SPECIES_META[summary.petSpecies].label : "–"}</div>
          <div className="text-[10px] text-[#8D8998]">Haustier</div>
        </div>
        <div>
          <div className="text-sm font-extrabold text-[#F8F7FC] tabular-nums">
            {Math.min(summary.todayMeat, summary.meatGoal)}/{summary.meatGoal}
          </div>
          <div className="text-[10px] text-[#8D8998]">Futter</div>
        </div>
      </div>
      <Link
        href="/hero"
        className="flex items-center justify-center gap-1 text-xs font-semibold text-[#A855F7] hover:text-[#C084FC] rounded-lg px-2 py-1.5 hover:bg-[#171720] transition-colors"
      >
        Held öffnen <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
  );
}
