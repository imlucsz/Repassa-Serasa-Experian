-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "institutions" ADD COLUMN     "status" "InstitutionStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill: institutions that already exist pre-date the approval workflow and
-- were implicitly live; keep them operational. Only NEW registrations are pending.
UPDATE "institutions" SET "status" = 'APPROVED';

-- CreateIndex
CREATE INDEX "institutions_status_idx" ON "institutions"("status");
