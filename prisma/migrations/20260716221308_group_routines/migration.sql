-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('PENDING', 'JOINED', 'DECLINED', 'LEFT');

-- CreateEnum
CREATE TYPE "GroupRoutineStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "GroupRoutineVisibility" AS ENUM ('ALL_MEMBERS', 'PARTICIPANTS_ONLY');

-- CreateEnum
CREATE TYPE "GroupRoutineGoalType" AS ENUM ('NONE', 'WEEKLY');

-- CreateEnum
CREATE TYPE "GroupRoutineAwardType" AS ENUM ('CHAMPION', 'STREAK_MEISTER', 'COMEBACK_STAR', 'TEAMPLAYER', 'PERFECT_WOCHE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_ROUTINE_ADDED';
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_ROUTINE_CHAMPION';

-- DropIndex
DROP INDEX "UserBadge_userId_badgeId_challengeId_key";

-- AlterTable
ALTER TABLE "UserBadge" ADD COLUMN     "groupRoutineId" TEXT;

-- CreateTable
CREATE TABLE "GroupRoutine" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "Category" NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Sparkles',
    "color" TEXT NOT NULL DEFAULT '#4FA8D8',
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "xpReward" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "scheduledDays" INTEGER[],
    "timeOfDay" TEXT,
    "visibility" "GroupRoutineVisibility" NOT NULL DEFAULT 'ALL_MEMBERS',
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "goalType" "GroupRoutineGoalType" NOT NULL DEFAULT 'NONE',
    "goalTarget" INTEGER,
    "status" "GroupRoutineStatus" NOT NULL DEFAULT 'ACTIVE',
    "pausedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRoutineParticipant" (
    "id" TEXT NOT NULL,
    "groupRoutineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ParticipationStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupRoutineParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRoutineCompletion" (
    "id" TEXT NOT NULL,
    "groupRoutineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "xpAwarded" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupRoutineCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRoutineAward" (
    "id" TEXT NOT NULL,
    "groupRoutineId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "GroupRoutineAwardType" NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupRoutineAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupRoutine_groupId_idx" ON "GroupRoutine"("groupId");

-- CreateIndex
CREATE INDEX "GroupRoutine_groupId_status_idx" ON "GroupRoutine"("groupId", "status");

-- CreateIndex
CREATE INDEX "GroupRoutineParticipant_userId_idx" ON "GroupRoutineParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRoutineParticipant_groupRoutineId_userId_key" ON "GroupRoutineParticipant"("groupRoutineId", "userId");

-- CreateIndex
CREATE INDEX "GroupRoutineCompletion_userId_date_idx" ON "GroupRoutineCompletion"("userId", "date");

-- CreateIndex
CREATE INDEX "GroupRoutineCompletion_groupRoutineId_date_idx" ON "GroupRoutineCompletion"("groupRoutineId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRoutineCompletion_groupRoutineId_userId_date_key" ON "GroupRoutineCompletion"("groupRoutineId", "userId", "date");

-- CreateIndex
CREATE INDEX "GroupRoutineAward_groupRoutineId_weekKey_idx" ON "GroupRoutineAward"("groupRoutineId", "weekKey");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRoutineAward_groupRoutineId_weekKey_type_userId_key" ON "GroupRoutineAward"("groupRoutineId", "weekKey", "type", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_challengeId_groupRoutineId_key" ON "UserBadge"("userId", "badgeId", "challengeId", "groupRoutineId");

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_groupRoutineId_fkey" FOREIGN KEY ("groupRoutineId") REFERENCES "GroupRoutine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoutine" ADD CONSTRAINT "GroupRoutine_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoutine" ADD CONSTRAINT "GroupRoutine_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoutineParticipant" ADD CONSTRAINT "GroupRoutineParticipant_groupRoutineId_fkey" FOREIGN KEY ("groupRoutineId") REFERENCES "GroupRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoutineParticipant" ADD CONSTRAINT "GroupRoutineParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoutineCompletion" ADD CONSTRAINT "GroupRoutineCompletion_groupRoutineId_fkey" FOREIGN KEY ("groupRoutineId") REFERENCES "GroupRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoutineCompletion" ADD CONSTRAINT "GroupRoutineCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoutineAward" ADD CONSTRAINT "GroupRoutineAward_groupRoutineId_fkey" FOREIGN KEY ("groupRoutineId") REFERENCES "GroupRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoutineAward" ADD CONSTRAINT "GroupRoutineAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
