-- Safe 3-step column add: nullable -> backfill -> NOT NULL, so existing
-- DayPlanEntry rows are never dropped or left without a valid endDate.
-- For every pre-existing row, endDate = date (same-day block), which is exactly
-- correct since overnight blocks did not exist before this migration.

-- AlterTable: add nullable column first
ALTER TABLE "DayPlanEntry" ADD COLUMN     "endDate" DATE,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill: every existing entry was same-day, so endDate = date
UPDATE "DayPlanEntry" SET "endDate" = "date" WHERE "endDate" IS NULL;

-- Now safe to enforce NOT NULL
ALTER TABLE "DayPlanEntry" ALTER COLUMN "endDate" SET NOT NULL;

-- CreateIndex
CREATE INDEX "DayPlanEntry_userId_endDate_idx" ON "DayPlanEntry"("userId", "endDate");
