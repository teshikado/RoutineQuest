import { Prisma, type EquipmentSlot, type HeroCharacterType, type ItemRarity, type PetSpecies, type WeaponType } from "@prisma/client";
import { prisma } from "./prisma";
import { getLevelProgress } from "./xp";
import { todayDateOnly } from "./dates";
import {
  ARMOR_SET_KEYS_BY_RARITY,
  LEVEL_STRENGTH_BONUS_CAP,
  MEAT_DAILY_GOAL,
  MEAT_FEED_AMOUNT,
  MEAT_MAX_BALANCE,
  MEAT_PER_TASK,
  MILESTONE_LEVEL_INTERVAL,
  PET_STAGE_META,
  RARITY_META,
  RARITY_WEIGHTS_MILESTONE,
  RARITY_WEIGHTS_NORMAL,
  SLOT_STAT_PROFILE,
  SLOT_WEIGHTS,
  WEAPON_TYPE_META,
  WEAPON_TYPE_ORDER,
  armorSetItemName,
  deterministicSetKeyForRarity,
  levelStrengthBonus,
  weaponNameOptions,
  petStageForLevel,
} from "./hero-constants";

type TxClient = Prisma.TransactionClient;
type DbClient = TxClient | typeof prisma;

export type HeroErrorCode =
  | "HERO_PROFILE_NOT_FOUND"
  | "ITEM_NOT_FOUND"
  | "ITEM_NOT_OWNED"
  | "INVALID_EQUIPMENT_SLOT"
  | "REWARD_ALREADY_CLAIMED"
  | "REWARD_NOT_AVAILABLE"
  | "PET_ALREADY_SELECTED"
  | "PET_NOT_SELECTED"
  | "NOT_ENOUGH_MEAT"
  | "FEEDING_FAILED"
  | "LEGACY_MIGRATION_FAILED"
  | "ARMOR_SET_INCOMPLETE"
  | "NOT_AUTHORIZED";

export class HeroError extends Error {
  code: HeroErrorCode;
  constructor(message: string, code: HeroErrorCode) {
    super(message);
    this.code = code;
  }
}

/** User-facing message per error code, for API routes to fall back to if a HeroError's own
 * message isn't already suitable (all HeroErrors thrown in this file already carry a good
 * message, so routes mostly just forward `err.message` -- this exists for completeness and
 * for any future throw site that only sets a code). */
export const HERO_ERROR_MESSAGES: Record<HeroErrorCode, string> = {
  HERO_PROFILE_NOT_FOUND: "Dein Heldenprofil konnte nicht gefunden werden.",
  ITEM_NOT_FOUND: "Der Gegenstand konnte nicht gefunden werden.",
  ITEM_NOT_OWNED: "Dieser Gegenstand gehört dir nicht.",
  INVALID_EQUIPMENT_SLOT: "Ungültiger Ausrüstungsplatz.",
  REWARD_ALREADY_CLAIMED: "Diese Belohnung wurde bereits geöffnet.",
  REWARD_NOT_AVAILABLE: "Diese Belohnung ist nicht verfügbar.",
  PET_ALREADY_SELECTED: "Du hast bereits ein Haustier ausgewählt.",
  PET_NOT_SELECTED: "Du hast noch kein Haustier ausgewählt.",
  NOT_ENOUGH_MEAT: "Du hast nicht genug Fleisch.",
  FEEDING_FAILED: "Dein Haustier konnte nicht gefüttert werden.",
  LEGACY_MIGRATION_FAILED: "Die rückwirkenden Belohnungen konnten nicht vollständig erstellt werden.",
  ARMOR_SET_INCOMPLETE: "Du besitzt noch nicht alle vier Teile dieses Sets.",
  NOT_AUTHORIZED: "Nicht angemeldet.",
};

function weightedPick<T extends string>(weights: Partial<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    if (r < w) return key;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

/** Ensures a HeroProfile row exists (default appearance, meatBalance 0) without requiring
 * the user to have ever opened the Held page -- meat must start accruing from the very
 * first completed task, and character creation is a separate, later step (see
 * `needsCharacterSetup` in getHeroPageData). */
async function ensureHeroProfile(db: DbClient, userId: string) {
  return db.heroProfile.upsert({ where: { userId }, update: {}, create: { userId } });
}

/** Rolls a single reward for `level` entirely server-side: rarity (normal 40/30/20/10,
 * or guaranteed epic/legendary on every 10th "milestone" level), slot, weapon type (if
 * applicable), a strength value within the rarity's range plus a small level bonus, the
 * sub-stats derived from that strength, and a name -- then persists both the item and its
 * claim record. Never called directly by an API route; only through ensureRewardsUpToLevel
 * so the (userId, level) uniqueness is always respected. */
async function generateRewardForLevel(tx: TxClient, userId: string, level: number) {
  const isMilestone = level % MILESTONE_LEVEL_INTERVAL === 0;
  const rarity = weightedPick<ItemRarity>(isMilestone ? RARITY_WEIGHTS_MILESTONE : RARITY_WEIGHTS_NORMAL);
  const slot = weightedPick<EquipmentSlot>(SLOT_WEIGHTS);
  const weaponType: WeaponType | null = slot === "WEAPON" ? WEAPON_TYPE_ORDER[Math.floor(Math.random() * WEAPON_TYPE_ORDER.length)] : null;

  const [min, max] = RARITY_META[rarity].strengthRange;
  const base = min + Math.floor(Math.random() * (max - min + 1));
  const strength = Math.min(max + LEVEL_STRENGTH_BONUS_CAP, base + levelStrengthBonus(level));

  let attack = 0;
  let defense = 0;
  let health = 0;
  let speed = 0;
  let criticalChance = 0;

  if (slot === "WEAPON" && weaponType) {
    const wt = WEAPON_TYPE_META[weaponType];
    attack = Math.round(strength * wt.attackShare);
    speed = Math.round(strength * wt.speedShare);
    criticalChance = Math.min(40, Math.round(strength * 0.08) + wt.critBonus);
  } else {
    const profile = SLOT_STAT_PROFILE[slot as Exclude<EquipmentSlot, "WEAPON">];
    defense = Math.round(strength * profile.defense);
    health = Math.round(strength * profile.health);
    attack = Math.round(strength * profile.attack);
    speed = Math.round(strength * profile.speed);
  }

  let name: string;
  let armorSetKey: string | null = null;
  if (slot === "WEAPON" && weaponType) {
    const names = weaponNameOptions(weaponType, rarity);
    name = names[Math.floor(Math.random() * names.length)];
  } else {
    const setKeys = ARMOR_SET_KEYS_BY_RARITY[rarity];
    armorSetKey = setKeys[Math.floor(Math.random() * setKeys.length)];
    name = armorSetItemName(slot as Exclude<EquipmentSlot, "WEAPON">, armorSetKey as Parameters<typeof armorSetItemName>[1]);
  }

  const item = await tx.equipmentItem.create({
    data: { userId, rewardLevel: level, slot, rarity, weaponType, armorSetKey, name, strength, attack, defense, health, speed, criticalChance },
  });
  await tx.heroRewardClaim.create({ data: { userId, level, itemId: item.id, isMilestone } });
  return item;
}

/** Idempotently makes sure every level from 1 up to `currentLevel` has exactly one reward
 * claim -- this single function IS the "legacy migration": a brand-new user only has level
 * 1 to backfill, a pre-existing level-6 user has levels 1..6, and calling this again for
 * either later is always a safe no-op for the levels it already handled. If the process is
 * interrupted partway (e.g. a timeout), the next call picks up exactly where it left off. */
export async function ensureRewardsUpToLevel(userId: string, currentLevel: number): Promise<{ created: number }> {
  const existing = await prisma.heroRewardClaim.findMany({ where: { userId }, select: { level: true } });
  const have = new Set(existing.map((e) => e.level));
  const missing: number[] = [];
  for (let level = 1; level <= currentLevel; level++) {
    if (!have.has(level)) missing.push(level);
  }
  if (missing.length === 0) return { created: 0 };

  await prisma.$transaction(
    async (tx) => {
      await ensureHeroProfile(tx, userId);
      for (const level of missing) {
        try {
          await generateRewardForLevel(tx, userId, level);
        } catch (err) {
          // A concurrent request already created this level's claim -- unique constraint
          // on (userId, level) caught the race; safe to skip.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
          throw err;
        }
      }
    },
    { timeout: 30_000 }
  );

  return { created: missing.length };
}

/** Marks the user's initial appearance setup as complete -- gates whether the character
 * creation wizard shows on the Held page. Pet selection is intentionally independent (see
 * selectPet) since a user can finish appearance setup and pick a pet moments later. */
/** Handles both the initial character-creation flow AND later "Charakterdarstellung ändern"
 * edits (same endpoint, see /api/hero/character) -- either way only appearance fields are
 * touched. `legacyMigrationCompletedAt` is set (or re-set, harmlessly) every call, which is
 * fine since it only ever gates whether the creation wizard shows, not appearance data. */
export async function completeCharacterSetup(
  userId: string,
  input: {
    heroName: string | null;
    characterType: HeroCharacterType;
    skinTone: string;
    hairColor: string;
    hairStyle: string;
    bodyBuild: string;
  }
) {
  return prisma.heroProfile.upsert({
    where: { userId },
    update: { ...input, legacyMigrationCompletedAt: new Date() },
    create: { userId, ...input, legacyMigrationCompletedAt: new Date() },
  });
}

function computeHeroStrength(level: number, equippedStrengthSum: number, petBonus: number): number {
  return level * 5 + equippedStrengthSum + petBonus;
}

/** Idempotently assigns a set to every armor item (any slot but WEAPON) that predates the
 * set system, using a deterministic hash of the item's own ID so the same item always lands
 * on the same set across reloads/devices -- never re-rolled, never touches rarity/strength/
 * stats/name-independent fields. A no-op once every item has one. */
async function backfillArmorSetKeys(userId: string) {
  const unset = await prisma.equipmentItem.findMany({
    where: { userId, armorSetKey: null, slot: { not: "WEAPON" } },
    select: { id: true, rarity: true },
  });
  if (unset.length === 0) return;
  await prisma.$transaction(
    unset.map((item) =>
      prisma.equipmentItem.update({
        where: { id: item.id },
        data: { armorSetKey: deterministicSetKeyForRarity(item.id, item.rarity) },
      })
    )
  );
}

export async function getHeroPageData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const level = getLevelProgress(user.totalXp).level;

  await ensureRewardsUpToLevel(userId, level);
  await backfillArmorSetKeys(userId);

  const [profile, items, claims, pet, todayFeedLogs] = await Promise.all([
    ensureHeroProfile(prisma, userId),
    prisma.equipmentItem.findMany({ where: { userId }, include: { rewardClaim: true }, orderBy: { createdAt: "desc" } }),
    prisma.heroRewardClaim.findMany({ where: { userId }, include: { item: true }, orderBy: { level: "asc" } }),
    prisma.pet.findUnique({ where: { userId } }),
    prisma.petFeedingLog.findMany({ where: { userId, localDate: todayDateOnly() } }),
  ]);

  const equippedItems = items.filter((i) => i.isEquipped);
  const equipmentStrengthByLot: Record<EquipmentSlot, number> = { HELMET: 0, CHEST: 0, PANTS: 0, SHOES: 0, WEAPON: 0 };
  for (const i of equippedItems) equipmentStrengthByLot[i.slot] = i.strength;
  const equipmentStrengthTotal = equippedItems.reduce((s, i) => s + i.strength, 0);

  const stage = pet ? petStageForLevel(level) : null;
  const petBonus = stage ? PET_STAGE_META[stage].totalBonus : 0;
  const heroStrength = computeHeroStrength(level, equipmentStrengthTotal, petBonus);
  const justEvolved = !!(pet && stage && stage > pet.notifiedStage);

  const todayMeat = todayFeedLogs.reduce((s, l) => s + l.amount, 0);
  const pendingClaims = claims.filter((c) => !c.openedAt);
  // Gated on characterType specifically (not legacyMigrationCompletedAt) so an account that
  // already completed hero setup *before* male/female selection existed is still prompted
  // once for just that, without losing anything else (see completeCharacterSetup).
  const needsCharacterSetup = !profile.characterType;
  const isLegacyWelcome = needsCharacterSetup && level > 1 && !profile.legacyMigrationCompletedAt;
  // True for an account that already has a hero (items/pet/rewards) from before character
  // types existed -- gates the wizard's copy toward "choose your look" rather than
  // "welcome to the hero system" or the plain first-time flow.
  const isAppearanceUpgradeOnly = needsCharacterSetup && !!profile.legacyMigrationCompletedAt;

  return {
    level,
    profile,
    items,
    equippedItems,
    equipmentStrengthByLot,
    equipmentStrengthTotal,
    claims,
    pendingClaims,
    pet,
    stage,
    petBonus,
    heroStrength,
    todayMeat,
    justEvolved,
    needsCharacterSetup,
    isLegacyWelcome,
    isAppearanceUpgradeOnly,
  };
}

/** Lightweight version for the dashboard hero card -- avoids fetching the full item/claim
 * history just to show a summary. */
export async function getHeroDashboardSummary(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const level = getLevelProgress(user.totalXp).level;
  const profile = await prisma.heroProfile.findUnique({ where: { userId } });

  if (!profile || !profile.characterType) {
    return { needsCharacterSetup: true as const, level };
  }

  const [equippedItems, pet, todayFeedLogs, pendingCount] = await Promise.all([
    prisma.equipmentItem.findMany({ where: { userId, isEquipped: true }, select: { strength: true } }),
    prisma.pet.findUnique({ where: { userId } }),
    prisma.petFeedingLog.findMany({ where: { userId, localDate: todayDateOnly() }, select: { amount: true } }),
    prisma.heroRewardClaim.count({ where: { userId, openedAt: null } }),
  ]);

  const equipmentStrengthTotal = equippedItems.reduce((s, i) => s + i.strength, 0);
  const stage = pet ? petStageForLevel(level) : null;
  const petBonus = stage ? PET_STAGE_META[stage].totalBonus : 0;
  const heroStrength = computeHeroStrength(level, equipmentStrengthTotal, petBonus);
  const todayMeat = todayFeedLogs.reduce((s, l) => s + l.amount, 0);

  return {
    needsCharacterSetup: false as const,
    level,
    heroStrength,
    petSpecies: pet?.species ?? null,
    todayMeat,
    meatGoal: MEAT_DAILY_GOAL,
    pendingRewardCount: pendingCount,
  };
}

export async function equipItem(userId: string, itemId: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.equipmentItem.findUnique({ where: { id: itemId }, include: { rewardClaim: true } });
    if (!item) throw new HeroError("Der Gegenstand konnte nicht gefunden werden.", "ITEM_NOT_FOUND");
    if (item.userId !== userId) throw new HeroError("Dieser Gegenstand gehört dir nicht.", "ITEM_NOT_OWNED");
    if (!item.rewardClaim?.openedAt) throw new HeroError("Diese Belohnung wurde noch nicht geöffnet.", "REWARD_NOT_AVAILABLE");

    await tx.equipmentItem.updateMany({ where: { userId, slot: item.slot, isEquipped: true }, data: { isEquipped: false } });
    await tx.equipmentItem.update({ where: { id: itemId }, data: { isEquipped: true } });
  });
}

/** Equips one piece per armor slot (helmet/chest/pants/shoes) for the given set key -- all
 * four must already be owned by this user or nothing is changed. When a user owns more than
 * one piece of the same set+slot (possible if they got duplicate rolls), the highest-strength
 * one is used. Runs as a single transaction so a partial equip can never happen. */
export async function equipArmorSet(userId: string, armorSetKey: string) {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.equipmentItem.findMany({
      where: { userId, armorSetKey, rewardClaim: { openedAt: { not: null } } },
      include: { rewardClaim: true },
      orderBy: { strength: "desc" },
    });
    const bySlot = new Map<EquipmentSlot, (typeof owned)[number]>();
    for (const item of owned) {
      if (!bySlot.has(item.slot)) bySlot.set(item.slot, item);
    }
    const requiredSlots: EquipmentSlot[] = ["HELMET", "CHEST", "PANTS", "SHOES"];
    const toEquip = requiredSlots.map((slot) => bySlot.get(slot));
    if (toEquip.some((item) => !item)) {
      throw new HeroError("Du besitzt noch nicht alle vier Teile dieses Sets.", "ARMOR_SET_INCOMPLETE");
    }
    for (const slot of requiredSlots) {
      await tx.equipmentItem.updateMany({ where: { userId, slot, isEquipped: true }, data: { isEquipped: false } });
    }
    for (const item of toEquip) {
      await tx.equipmentItem.update({ where: { id: item!.id }, data: { isEquipped: true } });
    }
  });
}

export async function unequipItem(userId: string, itemId: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.equipmentItem.findUnique({ where: { id: itemId } });
    if (!item) throw new HeroError("Der Gegenstand konnte nicht gefunden werden.", "ITEM_NOT_FOUND");
    if (item.userId !== userId) throw new HeroError("Dieser Gegenstand gehört dir nicht.", "ITEM_NOT_OWNED");
    await tx.equipmentItem.update({ where: { id: itemId }, data: { isEquipped: false } });
  });
}

export async function toggleFavoriteItem(userId: string, itemId: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.equipmentItem.findUnique({ where: { id: itemId } });
    if (!item) throw new HeroError("Der Gegenstand konnte nicht gefunden werden.", "ITEM_NOT_FOUND");
    if (item.userId !== userId) throw new HeroError("Dieser Gegenstand gehört dir nicht.", "ITEM_NOT_OWNED");
    return tx.equipmentItem.update({ where: { id: itemId }, data: { isFavorite: !item.isFavorite } });
  });
}

/** Reveals a single reward. Idempotent by design -- opening an already-opened claim just
 * returns its existing (unchanged) state instead of erroring, so a page reload or a second
 * click can never re-roll or duplicate anything. */
export async function openRewardClaim(userId: string, claimId: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.heroRewardClaim.findUnique({ where: { id: claimId }, include: { item: true } });
    if (!claim || claim.userId !== userId) throw new HeroError("Diese Belohnung konnte nicht gefunden werden.", "REWARD_NOT_AVAILABLE");
    if (claim.openedAt) return claim;
    return tx.heroRewardClaim.update({ where: { id: claimId }, data: { openedAt: new Date() }, include: { item: true } });
  });
}

export async function openAllPendingRewards(userId: string) {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.heroRewardClaim.findMany({ where: { userId, openedAt: null } });
    const now = new Date();
    for (const claim of pending) {
      await tx.heroRewardClaim.update({ where: { id: claim.id }, data: { openedAt: now } });
    }
    return pending.length;
  });
}

export async function selectPet(userId: string, species: PetSpecies) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pet.findUnique({ where: { userId } });
    if (existing) throw new HeroError("Du hast bereits ein Haustier ausgewählt.", "PET_ALREADY_SELECTED");
    return tx.pet.create({ data: { userId, species, notifiedStage: 1 } });
  });
}

export async function acknowledgePetEvolution(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const level = getLevelProgress(user.totalXp).level;
  const stage = petStageForLevel(level);
  const pet = await prisma.pet.findUnique({ where: { userId } });
  if (!pet) throw new HeroError("Du hast noch kein Haustier ausgewählt.", "PET_NOT_SELECTED");
  if (stage <= pet.notifiedStage) return pet;
  return prisma.pet.update({ where: { userId }, data: { notifiedStage: stage } });
}

/** Atomic conditional decrement -- only succeeds if the balance is still sufficient at the
 * moment of the update, so two concurrent feed requests can never drive the balance
 * negative regardless of transaction isolation level. */
export async function feedPet(userId: string) {
  return prisma.$transaction(async (tx) => {
    const pet = await tx.pet.findUnique({ where: { userId } });
    if (!pet) throw new HeroError("Du hast noch kein Haustier ausgewählt.", "PET_NOT_SELECTED");
    await ensureHeroProfile(tx, userId);

    const result = await tx.heroProfile.updateMany({
      where: { userId, meatBalance: { gte: MEAT_FEED_AMOUNT } },
      data: { meatBalance: { decrement: MEAT_FEED_AMOUNT } },
    });
    if (result.count === 0) throw new HeroError("Du hast nicht genug Fleisch.", "NOT_ENOUGH_MEAT");

    const today = todayDateOnly();
    const log = await tx.petFeedingLog.create({ data: { userId, petId: pet.id, localDate: today, amount: MEAT_FEED_AMOUNT } });
    await tx.meatTransaction.create({
      data: { userId, amount: -MEAT_FEED_AMOUNT, type: "FEEDING", sourceType: "PET_FEEDING", sourceId: log.id },
    });

    const profile = await tx.heroProfile.findUniqueOrThrow({ where: { userId } });
    const todayTotal =
      (await tx.petFeedingLog.aggregate({ where: { userId, localDate: today }, _sum: { amount: true } }))._sum.amount ?? 0;

    return { meatBalance: profile.meatBalance, todayMeat: todayTotal };
  });
}

// ---------- Meat awarded for completed tasks (called from the completion services) ----------

/** Idempotent: a second call with the same (sourceType, sourceId) is a silent no-op, which
 * is what makes this safe against double-clicks and a day-plan entry linked to a routine
 * never granting meat twice for the same underlying completion. Always call with the same
 * `tx` the completion itself is being written in, so the meat award and the completion it's
 * for either both commit or both roll back together. */
export async function awardMeatForCompletion(tx: TxClient, userId: string, sourceType: string, sourceId: string) {
  const key = { userId_type_sourceType_sourceId: { userId, type: "TASK_REWARD" as const, sourceType, sourceId } };
  const existing = await tx.meatTransaction.findUnique({ where: key });
  if (existing) return;

  const profile = await ensureHeroProfile(tx, userId);
  const newBalance = Math.min(MEAT_MAX_BALANCE, profile.meatBalance + MEAT_PER_TASK);
  const applied = newBalance - profile.meatBalance;
  if (applied <= 0) return;

  await tx.meatTransaction.create({ data: { userId, amount: applied, type: "TASK_REWARD", sourceType, sourceId } });
  await tx.heroProfile.update({ where: { userId }, data: { meatBalance: newBalance } });
}

/** Reverses (up to) the amount originally awarded for `sourceId` when its completion is
 * undone. Never lets the balance go negative -- if some or all of that meat was already
 * spent feeding the pet, only what's still available is clawed back, and the feeding
 * history itself is never touched. Idempotent: a source that was never awarded, or whose
 * award was already reversed, is a silent no-op. */
export async function reverseMeatForCompletion(tx: TxClient, userId: string, sourceType: string, sourceId: string) {
  const originalKey = { userId_type_sourceType_sourceId: { userId, type: "TASK_REWARD" as const, sourceType, sourceId } };
  const original = await tx.meatTransaction.findUnique({ where: originalKey });
  if (!original) return;

  const reversalKey = { userId_type_sourceType_sourceId: { userId, type: "UNDO_ADJUSTMENT" as const, sourceType, sourceId } };
  const alreadyReversed = await tx.meatTransaction.findUnique({ where: reversalKey });
  if (alreadyReversed) return;

  const profile = await ensureHeroProfile(tx, userId);
  const deduction = Math.min(original.amount, profile.meatBalance);

  await tx.meatTransaction.create({ data: { userId, amount: -deduction, type: "UNDO_ADJUSTMENT", sourceType, sourceId } });
  if (deduction > 0) {
    await tx.heroProfile.update({ where: { userId }, data: { meatBalance: profile.meatBalance - deduction } });
  }
}
