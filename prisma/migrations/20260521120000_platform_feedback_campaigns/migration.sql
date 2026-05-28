-- AlterTable
ALTER TABLE "PlatformFeedback" ADD COLUMN "campaignId" TEXT,
ADD COLUMN "organizationId" TEXT,
ADD COLUMN "eventId" TEXT;

-- CreateTable
CREATE TABLE "PlatformFeedbackCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "autoShowOnLogin" BOOLEAN NOT NULL DEFAULT true,
    "requireEventEnded" BOOLEAN NOT NULL DEFAULT true,
    "visibleFrom" TIMESTAMP(3),
    "visibleUntil" TIMESTAMP(3),
    "title" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeedbackCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformFeedbackPromptDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "dismissUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeedbackPromptDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformFeedback_campaignId_idx" ON "PlatformFeedback"("campaignId");

-- CreateIndex
CREATE INDEX "PlatformFeedback_organizationId_eventId_idx" ON "PlatformFeedback"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "PlatformFeedbackCampaign_organizationId_isActive_idx" ON "PlatformFeedbackCampaign"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "PlatformFeedbackCampaign_eventId_idx" ON "PlatformFeedbackCampaign"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFeedbackPromptDismissal_userId_campaignId_key" ON "PlatformFeedbackPromptDismissal"("userId", "campaignId");

-- AddForeignKey
ALTER TABLE "PlatformFeedback" ADD CONSTRAINT "PlatformFeedback_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PlatformFeedbackCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformFeedback" ADD CONSTRAINT "PlatformFeedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformFeedback" ADD CONSTRAINT "PlatformFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformFeedbackCampaign" ADD CONSTRAINT "PlatformFeedbackCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformFeedbackCampaign" ADD CONSTRAINT "PlatformFeedbackCampaign_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformFeedbackPromptDismissal" ADD CONSTRAINT "PlatformFeedbackPromptDismissal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PlatformFeedbackCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
