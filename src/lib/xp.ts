import { RANKS, type RankDef } from "./constants";

/** XP required to advance from `level` to `level + 1`. Slowly increasing curve. */
export function xpRequiredForLevel(level: number): number {
  return Math.round(50 * Math.pow(level, 1.6));
}

export type LevelProgress = {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpRemaining: number;
  progressRatio: number;
};

/** Resolve level + progress-into-level from a total lifetime XP amount. */
export function getLevelProgress(totalXp: number): LevelProgress {
  let level = 1;
  let xpConsumed = 0;

  while (true) {
    const need = xpRequiredForLevel(level);
    if (xpConsumed + need > totalXp) break;
    xpConsumed += need;
    level += 1;
    if (level > 500) break; // safety guard
  }

  const xpForNextLevel = xpRequiredForLevel(level);
  const xpIntoLevel = totalXp - xpConsumed;

  return {
    level,
    totalXp,
    xpIntoLevel,
    xpForNextLevel,
    xpRemaining: Math.max(0, xpForNextLevel - xpIntoLevel),
    progressRatio: Math.min(1, xpIntoLevel / xpForNextLevel),
  };
}

export function getRankForLevel(level: number): RankDef {
  return (
    RANKS.find((r) => level >= r.minLevel && (r.maxLevel === null || level <= r.maxLevel)) ??
    RANKS[RANKS.length - 1]
  );
}

export function getNextRank(level: number): RankDef | null {
  const current = getRankForLevel(level);
  const idx = RANKS.findIndex((r) => r.key === current.key);
  return RANKS[idx + 1] ?? null;
}
