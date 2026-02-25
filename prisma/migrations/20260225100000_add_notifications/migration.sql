-- CreateEnum
CREATE TYPE "NotificationFrequency" AS ENUM ('DAILY');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('DAILY_DIGEST');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "channelInApp" BOOLEAN NOT NULL DEFAULT true,
  "channelEmail" BOOLEAN NOT NULL DEFAULT true,
  "channelSms" BOOLEAN NOT NULL DEFAULT false,
  "frequency" "NotificationFrequency" NOT NULL DEFAULT 'DAILY',
  "digestHour" INTEGER NOT NULL DEFAULT 9,
  "digestMinute" INTEGER NOT NULL DEFAULT 0,
  "timezone" TEXT NOT NULL DEFAULT 'America/Indiana/Indianapolis',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "linkUrl" TEXT,
  "digestDate" TEXT,
  "dedupeKey" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundEmail" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "htmlBody" TEXT NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT,
  "providerMessageId" TEXT,
  "digestDate" TEXT,
  "dedupeKey" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),

  CONSTRAINT "OutboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreference_enabled_idx" ON "NotificationPreference"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_kind_idx" ON "Notification"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundEmail_dedupeKey_key" ON "OutboundEmail"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboundEmail_organizationId_createdAt_idx" ON "OutboundEmail"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundEmail_userId_createdAt_idx" ON "OutboundEmail"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundEmail_status_idx" ON "OutboundEmail"("status");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
