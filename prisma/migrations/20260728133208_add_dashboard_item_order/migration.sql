-- CreateEnum
CREATE TYPE "DashboardItemType" AS ENUM ('PERSONAL_ROUTINE', 'GROUP_ROUTINE');

-- CreateTable
CREATE TABLE "DashboardItemOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" "DashboardItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardItemOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardItemOrder_userId_idx" ON "DashboardItemOrder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardItemOrder_userId_itemType_itemId_key" ON "DashboardItemOrder"("userId", "itemType", "itemId");

-- AddForeignKey
ALTER TABLE "DashboardItemOrder" ADD CONSTRAINT "DashboardItemOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
