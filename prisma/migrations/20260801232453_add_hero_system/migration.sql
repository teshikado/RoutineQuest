-- CreateEnum
CREATE TYPE "EquipmentSlot" AS ENUM ('HELMET', 'CHEST', 'PANTS', 'SHOES', 'WEAPON');

-- CreateEnum
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "WeaponType" AS ENUM ('KATANA', 'GREATSWORD', 'DAGGER', 'SWORD', 'SPEAR');

-- CreateEnum
CREATE TYPE "PetSpecies" AS ENUM ('WOLF', 'SNAKE', 'LION', 'TIGER', 'BEAR', 'EAGLE', 'PANTHER');

-- CreateEnum
CREATE TYPE "MeatTransactionType" AS ENUM ('TASK_REWARD', 'FEEDING', 'UNDO_ADJUSTMENT', 'LEGACY_MIGRATION');

-- CreateTable
CREATE TABLE "HeroProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "heroName" TEXT,
    "skinTone" TEXT NOT NULL DEFAULT '#E8B48C',
    "hairStyle" TEXT NOT NULL DEFAULT 'short',
    "hairColor" TEXT NOT NULL DEFAULT '#3A2A1E',
    "eyeColor" TEXT NOT NULL DEFAULT '#4A3728',
    "meatBalance" INTEGER NOT NULL DEFAULT 0,
    "legacyMigrationCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardLevel" INTEGER NOT NULL,
    "slot" "EquipmentSlot" NOT NULL,
    "rarity" "ItemRarity" NOT NULL,
    "weaponType" "WeaponType",
    "name" TEXT NOT NULL,
    "strength" INTEGER NOT NULL,
    "attack" INTEGER NOT NULL DEFAULT 0,
    "defense" INTEGER NOT NULL DEFAULT 0,
    "health" INTEGER NOT NULL DEFAULT 0,
    "speed" INTEGER NOT NULL DEFAULT 0,
    "criticalChance" INTEGER NOT NULL DEFAULT 0,
    "isEquipped" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroRewardClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeroRewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "species" "PetSpecies" NOT NULL,
    "notifiedStage" INTEGER NOT NULL DEFAULT 1,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetFeedingLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetFeedingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeatTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "MeatTransactionType" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeatTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HeroProfile_userId_key" ON "HeroProfile"("userId");

-- CreateIndex
CREATE INDEX "HeroProfile_userId_idx" ON "HeroProfile"("userId");

-- CreateIndex
CREATE INDEX "EquipmentItem_userId_idx" ON "EquipmentItem"("userId");

-- CreateIndex
CREATE INDEX "EquipmentItem_userId_isEquipped_idx" ON "EquipmentItem"("userId", "isEquipped");

-- CreateIndex
CREATE INDEX "EquipmentItem_userId_slot_idx" ON "EquipmentItem"("userId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "HeroRewardClaim_itemId_key" ON "HeroRewardClaim"("itemId");

-- CreateIndex
CREATE INDEX "HeroRewardClaim_userId_openedAt_idx" ON "HeroRewardClaim"("userId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HeroRewardClaim_userId_level_key" ON "HeroRewardClaim"("userId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Pet_userId_key" ON "Pet"("userId");

-- CreateIndex
CREATE INDEX "Pet_userId_idx" ON "Pet"("userId");

-- CreateIndex
CREATE INDEX "PetFeedingLog_userId_localDate_idx" ON "PetFeedingLog"("userId", "localDate");

-- CreateIndex
CREATE INDEX "MeatTransaction_userId_createdAt_idx" ON "MeatTransaction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeatTransaction_userId_type_sourceType_sourceId_key" ON "MeatTransaction"("userId", "type", "sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "HeroProfile" ADD CONSTRAINT "HeroProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentItem" ADD CONSTRAINT "EquipmentItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeroRewardClaim" ADD CONSTRAINT "HeroRewardClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeroRewardClaim" ADD CONSTRAINT "HeroRewardClaim_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EquipmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetFeedingLog" ADD CONSTRAINT "PetFeedingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetFeedingLog" ADD CONSTRAINT "PetFeedingLog_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeatTransaction" ADD CONSTRAINT "MeatTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
