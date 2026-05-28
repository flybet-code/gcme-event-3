-- AlterTable
ALTER TABLE "Registration" ADD COLUMN "eventId" TEXT;

-- CreateIndex
CREATE INDEX "Registration_eventId_idx" ON "Registration"("eventId");
