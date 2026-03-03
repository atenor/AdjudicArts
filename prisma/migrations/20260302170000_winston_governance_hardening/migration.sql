-- CreateEnum
CREATE TYPE "JudgeSubmissionStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "JudgeSubmissionEventType" AS ENUM ('FINALIZED', 'REOPENED');

-- CreateEnum
CREATE TYPE "AudienceFavoriteSnapshotType" AS ENUM ('BASELINE', 'END');

-- CreateEnum
CREATE TYPE "AudienceFavoriteDispositionStatus" AS ENUM ('ELIGIBLE', 'FLAGGED', 'DISQUALIFIED');

-- CreateTable
CREATE TABLE "JudgeSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "status" "JudgeSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeSubmissionEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "eventType" "JudgeSubmissionEventType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JudgeSubmissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundCertification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "certifiedById" TEXT NOT NULL,
    "certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgePrizeSuggestion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgePrizeSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChairPrizeAllocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "internalNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChairPrizeAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceFavoriteSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "snapshotType" "AudienceFavoriteSnapshotType" NOT NULL,
    "viewCount" INTEGER NOT NULL,
    "capturedById" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudienceFavoriteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceFavoriteDisposition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "AudienceFavoriteDispositionStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "note" TEXT NOT NULL,
    "actedById" TEXT NOT NULL,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudienceFavoriteDisposition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JudgeSubmission_applicationId_judgeId_roundId_key" ON "JudgeSubmission"("applicationId", "judgeId", "roundId");

-- CreateIndex
CREATE INDEX "JudgeSubmission_organizationId_idx" ON "JudgeSubmission"("organizationId");

-- CreateIndex
CREATE INDEX "JudgeSubmission_roundId_status_idx" ON "JudgeSubmission"("roundId", "status");

-- CreateIndex
CREATE INDEX "JudgeSubmission_judgeId_roundId_idx" ON "JudgeSubmission"("judgeId", "roundId");

-- CreateIndex
CREATE INDEX "JudgeSubmissionEvent_organizationId_idx" ON "JudgeSubmissionEvent"("organizationId");

-- CreateIndex
CREATE INDEX "JudgeSubmissionEvent_submissionId_createdAt_idx" ON "JudgeSubmissionEvent"("submissionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoundCertification_roundId_key" ON "RoundCertification"("roundId");

-- CreateIndex
CREATE INDEX "RoundCertification_organizationId_idx" ON "RoundCertification"("organizationId");

-- CreateIndex
CREATE INDEX "RoundCertification_eventId_idx" ON "RoundCertification"("eventId");

-- CreateIndex
CREATE INDEX "JudgePrizeSuggestion_organizationId_idx" ON "JudgePrizeSuggestion"("organizationId");

-- CreateIndex
CREATE INDEX "JudgePrizeSuggestion_roundId_applicationId_idx" ON "JudgePrizeSuggestion"("roundId", "applicationId");

-- CreateIndex
CREATE INDEX "JudgePrizeSuggestion_judgeId_roundId_idx" ON "JudgePrizeSuggestion"("judgeId", "roundId");

-- CreateIndex
CREATE INDEX "ChairPrizeAllocation_organizationId_idx" ON "ChairPrizeAllocation"("organizationId");

-- CreateIndex
CREATE INDEX "ChairPrizeAllocation_roundId_applicationId_idx" ON "ChairPrizeAllocation"("roundId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "AudienceFavoriteSnapshot_roundId_applicationId_snapshotType_key" ON "AudienceFavoriteSnapshot"("roundId", "applicationId", "snapshotType");

-- CreateIndex
CREATE INDEX "AudienceFavoriteSnapshot_organizationId_idx" ON "AudienceFavoriteSnapshot"("organizationId");

-- CreateIndex
CREATE INDEX "AudienceFavoriteSnapshot_roundId_snapshotType_idx" ON "AudienceFavoriteSnapshot"("roundId", "snapshotType");

-- CreateIndex
CREATE UNIQUE INDEX "AudienceFavoriteDisposition_roundId_applicationId_key" ON "AudienceFavoriteDisposition"("roundId", "applicationId");

-- CreateIndex
CREATE INDEX "AudienceFavoriteDisposition_organizationId_idx" ON "AudienceFavoriteDisposition"("organizationId");

-- CreateIndex
CREATE INDEX "AudienceFavoriteDisposition_roundId_status_idx" ON "AudienceFavoriteDisposition"("roundId", "status");

-- AddForeignKey
ALTER TABLE "JudgeSubmission" ADD CONSTRAINT "JudgeSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeSubmission" ADD CONSTRAINT "JudgeSubmission_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeSubmission" ADD CONSTRAINT "JudgeSubmission_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeSubmission" ADD CONSTRAINT "JudgeSubmission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeSubmission" ADD CONSTRAINT "JudgeSubmission_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeSubmissionEvent" ADD CONSTRAINT "JudgeSubmissionEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeSubmissionEvent" ADD CONSTRAINT "JudgeSubmissionEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "JudgeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeSubmissionEvent" ADD CONSTRAINT "JudgeSubmissionEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundCertification" ADD CONSTRAINT "RoundCertification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundCertification" ADD CONSTRAINT "RoundCertification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundCertification" ADD CONSTRAINT "RoundCertification_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundCertification" ADD CONSTRAINT "RoundCertification_certifiedById_fkey" FOREIGN KEY ("certifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgePrizeSuggestion" ADD CONSTRAINT "JudgePrizeSuggestion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgePrizeSuggestion" ADD CONSTRAINT "JudgePrizeSuggestion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgePrizeSuggestion" ADD CONSTRAINT "JudgePrizeSuggestion_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgePrizeSuggestion" ADD CONSTRAINT "JudgePrizeSuggestion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgePrizeSuggestion" ADD CONSTRAINT "JudgePrizeSuggestion_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairPrizeAllocation" ADD CONSTRAINT "ChairPrizeAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairPrizeAllocation" ADD CONSTRAINT "ChairPrizeAllocation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairPrizeAllocation" ADD CONSTRAINT "ChairPrizeAllocation_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairPrizeAllocation" ADD CONSTRAINT "ChairPrizeAllocation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairPrizeAllocation" ADD CONSTRAINT "ChairPrizeAllocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceFavoriteSnapshot" ADD CONSTRAINT "AudienceFavoriteSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceFavoriteSnapshot" ADD CONSTRAINT "AudienceFavoriteSnapshot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceFavoriteSnapshot" ADD CONSTRAINT "AudienceFavoriteSnapshot_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceFavoriteSnapshot" ADD CONSTRAINT "AudienceFavoriteSnapshot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceFavoriteSnapshot" ADD CONSTRAINT "AudienceFavoriteSnapshot_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceFavoriteDisposition" ADD CONSTRAINT "AudienceFavoriteDisposition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceFavoriteDisposition" ADD CONSTRAINT "AudienceFavoriteDisposition_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceFavoriteDisposition" ADD CONSTRAINT "AudienceFavoriteDisposition_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceFavoriteDisposition" ADD CONSTRAINT "AudienceFavoriteDisposition_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceFavoriteDisposition" ADD CONSTRAINT "AudienceFavoriteDisposition_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
