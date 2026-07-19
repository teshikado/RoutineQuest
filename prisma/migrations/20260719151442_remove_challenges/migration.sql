-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('ROUTINE_REMINDER', 'STREAK_AT_RISK', 'GROUP_INVITE', 'LEVEL_UP', 'RANK_UP', 'WEEKLY_REPORT', 'GROUP_ROUTINE_ADDED', 'GROUP_ROUTINE_CHAMPION');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TABLE "NotificationSetting" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Challenge" DROP CONSTRAINT "Challenge_groupId_fkey";

-- DropForeignKey
ALTER TABLE "UserBadge" DROP CONSTRAINT "UserBadge_challengeId_fkey";

-- DropIndex
DROP INDEX "UserBadge_userId_badgeId_challengeId_groupRoutineId_key";

-- AlterTable
ALTER TABLE "UserBadge" DROP COLUMN "challengeId";

-- DropTable
DROP TABLE "Challenge";

-- DropEnum
DROP TYPE "ChallengeType";

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_groupRoutineId_key" ON "UserBadge"("userId", "badgeId", "groupRoutineId");

