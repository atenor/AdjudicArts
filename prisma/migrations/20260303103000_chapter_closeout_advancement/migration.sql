ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'DID_NOT_ADVANCE';

ALTER TABLE "Round"
ADD COLUMN "advancementSlots" INTEGER;

UPDATE "Round"
SET "advancementSlots" = 2
WHERE "type" = 'CHAPTER'
  AND "advancementSlots" IS NULL;
