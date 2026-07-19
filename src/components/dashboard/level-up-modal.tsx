"use client";

import { motion } from "framer-motion";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/ui/rank-badge";
import { Confetti } from "@/components/ui/confetti";
import { getRankForLevel } from "@/lib/xp";

export function LevelUpModal({
  open,
  onClose,
  level,
  rankedUp,
}: {
  open: boolean;
  onClose: () => void;
  level: number;
  rankedUp: boolean;
}) {
  const rank = getRankForLevel(level);

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-sm">
      <div className="relative text-center py-4">
        <Confetti active={open} pieces={rankedUp ? 30 : 18} />

        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 15 }}
          className="mx-auto mb-4 w-fit"
        >
          <RankBadge icon={rank.icon} color={rank.color} size="xl" glow />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="text-2xl font-extrabold text-[#F8F7FC] mb-1"
        >
          Level Up!
        </motion.h2>
        <p className="text-[#C8C5D2] mb-1">Du bist jetzt Level {level}.</p>
        {rankedUp && (
          <p className="font-bold mb-4" style={{ color: rank.color }}>
            Neuer Rang: {rank.name}
          </p>
        )}
        {rankedUp && <p className="text-sm text-[#C8C5D2] mb-4">{rank.description}</p>}
        <Button onClick={onClose} className="mt-2">
          Weiter geht&apos;s
        </Button>
      </div>
    </Modal>
  );
}
