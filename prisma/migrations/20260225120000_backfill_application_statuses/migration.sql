-- Backfill legacy workflow statuses into canonical workflow statuses.
UPDATE "Application"
SET "status" = 'SUBMITTED_PENDING_APPROVAL'
WHERE "status" = 'SUBMITTED';

UPDATE "Application"
SET "status" = 'CHAPTER_ADJUDICATION'
WHERE "status" = 'CHAPTER_REVIEW';

UPDATE "Application"
SET "status" = 'NATIONAL_FINALS'
WHERE "status" = 'NATIONAL_REVIEW';
