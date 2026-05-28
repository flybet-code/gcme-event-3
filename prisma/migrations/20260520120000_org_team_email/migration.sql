-- CreateTable
CREATE TABLE "OrganizationEmailTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "cc" TEXT NOT NULL DEFAULT '',
    "bodyText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationEmailSent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "templateId" TEXT,
    "sentById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "toEmails" TEXT[],
    "ccEmails" TEXT[],
    "bodyText" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationEmailSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationEmailTemplate_organizationId_idx" ON "OrganizationEmailTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationEmailTemplate_organizationId_eventId_idx" ON "OrganizationEmailTemplate"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "OrganizationEmailSent_organizationId_createdAt_idx" ON "OrganizationEmailSent"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganizationEmailTemplate" ADD CONSTRAINT "OrganizationEmailTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationEmailTemplate" ADD CONSTRAINT "OrganizationEmailTemplate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationEmailSent" ADD CONSTRAINT "OrganizationEmailSent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationEmailSent" ADD CONSTRAINT "OrganizationEmailSent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationEmailSent" ADD CONSTRAINT "OrganizationEmailSent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OrganizationEmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
