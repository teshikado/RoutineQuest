-- CreateEnum
CREATE TYPE "HeroCharacterType" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "HeroProfile" ADD COLUMN     "characterType" "HeroCharacterType",
ALTER COLUMN "skinTone" SET DEFAULT 'medium',
ALTER COLUMN "hairStyle" SET DEFAULT 'natuerlich',
ALTER COLUMN "hairColor" SET DEFAULT 'brown';
