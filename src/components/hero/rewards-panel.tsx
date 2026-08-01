"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EQUIPMENT_SLOT_META, RARITY_META, WEAPON_TYPE_META } from "@/lib/hero-constants";
import { EquipmentSprite } from "./equipment-sprite";
import type { HeroRewardClaim } from "./hero-types";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

function RewardRevealModal({
  claim,
  onClose,
  onEquip,
}: {
  claim: HeroRewardClaim;
  onClose: () => void;
  onEquip: (itemId: string) => Promise<void>;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [equipping, setEquipping] = useState(false);
  const meta = RARITY_META[claim.item.rarity];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050507]/90 backdrop-blur-sm p-4">
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.15 : 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-2xl border p-6 text-center"
        style={{
          borderColor: meta.color,
          background: claim.isMilestone ? "linear-gradient(160deg, #171720, #1a1420)" : "#111118",
          boxShadow: meta.glow,
        }}
      >
        {claim.isMilestone && (
          <div className="mb-3">
            <div className="text-xs font-extrabold tracking-wide text-[#FACC15]">MEILENSTEIN-BELOHNUNG!</div>
            <div className="text-[11px] text-[#C8C5D2]">Garantiert episch oder legendär.</div>
          </div>
        )}
        <div className="text-xs font-semibold text-[#8D8998] mb-2">Level {claim.level} erreicht!</div>
        <EquipmentSprite
          slot={claim.item.slot}
          weaponType={claim.item.weaponType}
          rarity={claim.item.rarity}
          className="w-32 h-28 mx-auto mb-3"
          title={claim.item.name}
        />
        <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: meta.color }}>
          {meta.label}
        </div>
        <h3 className="text-lg font-extrabold text-[#F8F7FC] mb-1">{claim.item.name}</h3>
        <div className="text-xs text-[#8D8998] mb-3">
          {EQUIPMENT_SLOT_META[claim.item.slot].label}
          {claim.item.weaponType ? ` · ${WEAPON_TYPE_META[claim.item.weaponType].label}` : ""}
        </div>
        <div className="text-2xl font-extrabold text-[#F8F7FC] tabular-nums mb-4">Stärke {claim.item.strength}</div>

        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Zum Inventar
          </Button>
          <Button
            size="sm"
            loading={equipping}
            onClick={async () => {
              setEquipping(true);
              try {
                await onEquip(claim.item.id);
                onClose();
              } finally {
                setEquipping(false);
              }
            }}
          >
            Ausrüsten
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export function RewardsPanel({
  pendingClaims,
  onOpen,
  onOpenAll,
  onEquip,
}: {
  pendingClaims: HeroRewardClaim[];
  onOpen: (claimId: string) => Promise<HeroRewardClaim>;
  onOpenAll: () => Promise<void>;
  onEquip: (itemId: string) => Promise<void>;
}) {
  const [revealClaim, setRevealClaim] = useState<HeroRewardClaim | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openingAll, setOpeningAll] = useState(false);

  async function handleOpen(claim: HeroRewardClaim) {
    setOpeningId(claim.id);
    try {
      const opened = await onOpen(claim.id);
      setRevealClaim(opened);
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-bold text-[#F8F7FC] flex items-center gap-1.5">
          <Gift className="h-4 w-4 text-[#A855F7]" /> Levelbelohnungen
        </h2>
        {pendingClaims.length > 1 && (
          <Button
            size="sm"
            variant="secondary"
            loading={openingAll}
            onClick={async () => {
              setOpeningAll(true);
              try {
                await onOpenAll();
              } finally {
                setOpeningAll(false);
              }
            }}
          >
            Alle öffnen
          </Button>
        )}
      </div>

      {pendingClaims.length === 0 ? (
        <p className="text-sm text-[#8D8998]">Keine ungeöffneten Belohnungen. Erreiche ein neues Level, um die nächste zu bekommen.</p>
      ) : (
        <>
          <p className="text-sm text-[#C8C5D2] mb-3">
            {pendingClaims.length} ungeöffnete {pendingClaims.length === 1 ? "Belohnung" : "Belohnungen"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pendingClaims.map((claim) => (
              <div
                key={claim.id}
                className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${
                  claim.isMilestone ? "border-[#FACC15]/50 bg-[#FACC15]/5" : "border-[#292936] bg-[#171720]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className={`h-4 w-4 shrink-0 ${claim.isMilestone ? "text-[#FACC15]" : "text-[#A855F7]"}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#F8F7FC]">Level {claim.level}</div>
                    {claim.isMilestone && <div className="text-[10px] font-bold text-[#FACC15]">Meilenstein</div>}
                  </div>
                </div>
                <Button size="sm" onClick={() => handleOpen(claim)} loading={openingId === claim.id}>
                  Öffnen
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <AnimatePresence>
        {revealClaim && (
          <RewardRevealModal claim={revealClaim} onClose={() => setRevealClaim(null)} onEquip={onEquip} />
        )}
      </AnimatePresence>
    </Card>
  );
}
