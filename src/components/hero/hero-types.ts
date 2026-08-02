import type { EquipmentSlot, HeroCharacterType, ItemRarity, PetSpecies, WeaponType } from "@prisma/client";
import type { HairColorKey, HairStyleKey, SkinToneKey } from "@/lib/hero-assets";

export type HeroItemFields = {
  id: string;
  rewardLevel: number;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  weaponType: WeaponType | null;
  name: string;
  strength: number;
  attack: number;
  defense: number;
  health: number;
  speed: number;
  criticalChance: number;
  isEquipped: boolean;
  isFavorite: boolean;
  createdAt: string | Date;
};

export type HeroEquipmentItem = HeroItemFields & {
  rewardClaim: { id: string; level: number; isMilestone: boolean; openedAt: string | Date | null } | null;
};

export type HeroRewardClaim = {
  id: string;
  level: number;
  isMilestone: boolean;
  openedAt: string | Date | null;
  createdAt: string | Date;
  item: HeroItemFields;
};

export type HeroPet = {
  id: string;
  species: PetSpecies;
  notifiedStage: number;
  selectedAt: string | Date;
};

export type HeroProfileData = {
  heroName: string | null;
  characterType: HeroCharacterType | null;
  skinTone: string;
  hairColor: string;
  hairStyle: string;
  meatBalance: number;
  legacyMigrationCompletedAt: string | Date | null;
};

export type HeroAppearance = { characterType: HeroCharacterType; skinTone: SkinToneKey; hairColor: HairColorKey; hairStyle: HairStyleKey };

export type HeroPageData = {
  level: number;
  profile: HeroProfileData;
  items: HeroEquipmentItem[];
  equippedItems: HeroEquipmentItem[];
  equipmentStrengthByLot: Record<EquipmentSlot, number>;
  equipmentStrengthTotal: number;
  claims: HeroRewardClaim[];
  pendingClaims: HeroRewardClaim[];
  pet: HeroPet | null;
  stage: 1 | 2 | 3 | 4 | null;
  petBonus: number;
  heroStrength: number;
  todayMeat: number;
  justEvolved: boolean;
  needsCharacterSetup: boolean;
  isLegacyWelcome: boolean;
  isAppearanceUpgradeOnly: boolean;
};
