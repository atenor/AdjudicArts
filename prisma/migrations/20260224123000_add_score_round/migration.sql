-- CreateEnum
CREATE TYPE "ScoreRound" AS ENUM ('CHAPTER', 'NATIONAL');

-- AlterTable
ALTER TABLE "Score"
ADD COLUMN "round" "ScoreRound" NOT NULL DEFAULT 'CHAPTER';

-- DropIndex
DROP INDEX "Score_applicationId_criteriaId_judgeId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Score_applicationId_criteriaId_judgeId_round_key"
ON "Score"("applicationId", "criteriaId", "judgeId", "round");
