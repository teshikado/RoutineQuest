-- DropForeignKey
ALTER TABLE "EquipmentItem" DROP CONSTRAINT "EquipmentItem_userId_fkey";

-- DropForeignKey
ALTER TABLE "HeroProfile" DROP CONSTRAINT "HeroProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "HeroRewardClaim" DROP CONSTRAINT "HeroRewardClaim_itemId_fkey";

-- DropForeignKey
ALTER TABLE "HeroRewardClaim" DROP CONSTRAINT "HeroRewardClaim_userId_fkey";

-- DropForeignKey
ALTER TABLE "MeatTransaction" DROP CONSTRAINT "MeatTransaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "Pet" DROP CONSTRAINT "Pet_userId_fkey";

-- DropForeignKey
ALTER TABLE "PetFeedingLog" DROP CONSTRAINT "PetFeedingLog_petId_fkey";

-- DropForeignKey
ALTER TABLE "PetFeedingLog" DROP CONSTRAINT "PetFeedingLog_userId_fkey";

-- DropTable
DROP TABLE "EquipmentItem";

-- DropTable
DROP TABLE "HeroProfile";

-- DropTable
DROP TABLE "HeroRewardClaim";

-- DropTable
DROP TABLE "MeatTransaction";

-- DropTable
DROP TABLE "Pet";

-- DropTable
DROP TABLE "PetFeedingLog";

-- DropEnum
DROP TYPE "EquipmentSlot";

-- DropEnum
DROP TYPE "HeroCharacterType";

-- DropEnum
DROP TYPE "ItemRarity";

-- DropEnum
DROP TYPE "MeatTransactionType";

-- DropEnum
DROP TYPE "PetSpecies";

-- DropEnum
DROP TYPE "WeaponType";

