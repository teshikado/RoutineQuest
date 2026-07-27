-- CreateEnum
CREATE TYPE "DayPlanRecurrenceType" AS ENUM ('SINGLE_DAY', 'EVERY_DAY', 'WEEKDAYS', 'WEEKEND', 'CUSTOM_DAYS');

-- CreateEnum
CREATE TYPE "DayPlanEntryCategory" AS ENUM ('WORK', 'TRADING', 'LEARNING', 'SPORT', 'HEALTH', 'LEISURE', 'BREAK', 'APPOINTMENT', 'HOUSEHOLD', 'SLEEP', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "DayPlanEntryPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DayPlanEntryStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'MOVED');

-- CreateEnum
CREATE TYPE "DayReviewMood" AS ENUM ('GREAT', 'GOOD', 'OKAY', 'HARD', 'BAD');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "xpForDayPlanning" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DayPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "color" TEXT NOT NULL DEFAULT '#A855F7',
    "icon" TEXT NOT NULL DEFAULT 'CalendarClock',
    "recurrenceType" "DayPlanRecurrenceType" NOT NULL DEFAULT 'SINGLE_DAY',
    "recurrenceDays" INTEGER[],
    "reminderMinutes" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayPlanEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayPlanId" TEXT,
    "seriesId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "category" "DayPlanEntryCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "DayPlanEntryPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "DayPlanEntryStatus" NOT NULL DEFAULT 'PLANNED',
    "color" TEXT NOT NULL DEFAULT '#A855F7',
    "icon" TEXT NOT NULL DEFAULT 'Clock',
    "location" TEXT,
    "link" TEXT,
    "notes" TEXT,
    "reminderMinutes" INTEGER,
    "linkedRoutineId" TEXT,
    "linkedGroupRoutineId" TEXT,
    "moveReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayPlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayPlanTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#A855F7',
    "icon" TEXT NOT NULL DEFAULT 'LayoutTemplate',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayPlanTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayPlanTemplateEntry" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "category" "DayPlanEntryCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "DayPlanEntryPriority" NOT NULL DEFAULT 'NORMAL',
    "color" TEXT NOT NULL DEFAULT '#A855F7',
    "icon" TEXT NOT NULL DEFAULT 'Clock',
    "location" TEXT,
    "link" TEXT,
    "notes" TEXT,
    "reminderMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DayPlanTemplateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mood" "DayReviewMood",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayPlan_userId_idx" ON "DayPlan"("userId");

-- CreateIndex
CREATE INDEX "DayPlan_userId_startDate_endDate_idx" ON "DayPlan"("userId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "DayPlanEntry_userId_date_idx" ON "DayPlanEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "DayPlanEntry_dayPlanId_idx" ON "DayPlanEntry"("dayPlanId");

-- CreateIndex
CREATE INDEX "DayPlanEntry_seriesId_idx" ON "DayPlanEntry"("seriesId");

-- CreateIndex
CREATE INDEX "DayPlanTemplate_userId_idx" ON "DayPlanTemplate"("userId");

-- CreateIndex
CREATE INDEX "DayPlanTemplateEntry_templateId_idx" ON "DayPlanTemplateEntry"("templateId");

-- CreateIndex
CREATE INDEX "DayReview_userId_idx" ON "DayReview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DayReview_userId_date_key" ON "DayReview"("userId", "date");

-- AddForeignKey
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlanEntry" ADD CONSTRAINT "DayPlanEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlanEntry" ADD CONSTRAINT "DayPlanEntry_dayPlanId_fkey" FOREIGN KEY ("dayPlanId") REFERENCES "DayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlanEntry" ADD CONSTRAINT "DayPlanEntry_linkedRoutineId_fkey" FOREIGN KEY ("linkedRoutineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlanEntry" ADD CONSTRAINT "DayPlanEntry_linkedGroupRoutineId_fkey" FOREIGN KEY ("linkedGroupRoutineId") REFERENCES "GroupRoutine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlanTemplate" ADD CONSTRAINT "DayPlanTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlanTemplateEntry" ADD CONSTRAINT "DayPlanTemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DayPlanTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayReview" ADD CONSTRAINT "DayReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
