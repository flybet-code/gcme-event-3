-- CreateTable
CREATE TABLE "OrganizationEventRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationEventRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMemberEventRole" (
    "id" TEXT NOT NULL,
    "organizationMemberId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "organizationEventRoleId" TEXT NOT NULL,

    CONSTRAINT "OrganizationMemberEventRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationEventRole_organizationId_eventId_idx" ON "OrganizationEventRole"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "OrganizationMemberEventRole_organizationEventRoleId_idx" ON "OrganizationMemberEventRole"("organizationEventRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMemberEventRole_organizationMemberId_eventId_key" ON "OrganizationMemberEventRole"("organizationMemberId", "eventId");

-- AddForeignKey
ALTER TABLE "OrganizationEventRole" ADD CONSTRAINT "OrganizationEventRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationEventRole" ADD CONSTRAINT "OrganizationEventRole_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationMemberEventRole" ADD CONSTRAINT "OrganizationMemberEventRole_organizationMemberId_fkey" FOREIGN KEY ("organizationMemberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationMemberEventRole" ADD CONSTRAINT "OrganizationMemberEventRole_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationMemberEventRole" ADD CONSTRAINT "OrganizationMemberEventRole_organizationEventRoleId_fkey" FOREIGN KEY ("organizationEventRoleId") REFERENCES "OrganizationEventRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
