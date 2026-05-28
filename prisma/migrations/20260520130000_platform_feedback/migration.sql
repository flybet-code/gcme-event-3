-- CreateEnum
CREATE TYPE "PlatformEaseRating" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "PlatformFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "easeRating" "PlatformEaseRating" NOT NULL,
    "recommendScore" INTEGER NOT NULL,
    "additionalText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFeedback_userId_key" ON "PlatformFeedback"("userId");

-- CreateIndex
CREATE INDEX "PlatformFeedback_createdAt_idx" ON "PlatformFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "PlatformFeedback" ADD CONSTRAINT "PlatformFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
