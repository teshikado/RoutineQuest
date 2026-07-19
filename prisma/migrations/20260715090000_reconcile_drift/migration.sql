-- Reconciles migration history with schema changes that were previously applied
-- directly to the database (Routine.archivedAt, XpTransaction refId uniqueness)
-- without a corresponding migration file. No-op against the current database;
-- recorded via `prisma migrate resolve --applied` rather than executed.

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "XpTransaction" ALTER COLUMN "refId" SET DEFAULT '';
UPDATE "XpTransaction" SET "refId" = '' WHERE "refId" IS NULL;
ALTER TABLE "XpTransaction" ALTER COLUMN "refId" SET NOT NULL;

-- DropIndex
DROP INDEX "XpTransaction_userId_reason_refDate_key";

-- CreateIndex
CREATE UNIQUE INDEX "XpTransaction_userId_reason_refDate_refId_key" ON "XpTransaction"("userId", "reason", "refDate", "refId");
