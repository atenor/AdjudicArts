-- CreateTable
CREATE TABLE "JudgeBookmark" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgeBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JudgeBookmark_judgeId_applicationId_key" ON "JudgeBookmark"("judgeId", "applicationId");

-- CreateIndex
CREATE INDEX "JudgeBookmark_organizationId_idx" ON "JudgeBookmark"("organizationId");

-- CreateIndex
CREATE INDEX "JudgeBookmark_applicationId_idx" ON "JudgeBookmark"("applicationId");

-- AddForeignKey
ALTER TABLE "JudgeBookmark" ADD CONSTRAINT "JudgeBookmark_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeBookmark" ADD CONSTRAINT "JudgeBookmark_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeBookmark" ADD CONSTRAINT "JudgeBookmark_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
