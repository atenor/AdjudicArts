-- AlterTable
ALTER TABLE "User" ADD COLUMN "chapter" TEXT;

-- CreateIndex
CREATE INDEX "User_chapter_idx" ON "User"("chapter");
