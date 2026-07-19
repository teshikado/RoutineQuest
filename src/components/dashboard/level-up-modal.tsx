"use client";

import { motion } from "framer-motion";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/icon";
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
      <div className="text-center py-4">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 15 }}
          className="h-20 w-20 rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg"
          style={{ backgroundColor: rank.color + "33" }}
        >
          <DynamicIcon name={rank.icon} className="h-10 w-10" style={{ color: rank.color }} />
        </motion.div>
        <h2 className="text-2xl font-extrabold text-[#183B56] mb-1">Level Up!</h2>
        <p className="text-[#5b7a91] mb-1">Du bist jetzt Level {level}.</p>
        {rankedUp && (
          <p className="font-bold mb-4" style={{ color: rank.color }}>
            Neuer Rang: {rank.name}
          </p>
        )}
        {rankedUp && <p className="text-sm text-[#5b7a91] mb-4">{rank.description}</p>}
        <Button onClick={onClose} className="mt-2">
          Weiter geht&apos;s
        </Button>
      </div>
    </Modal>
  );
}
