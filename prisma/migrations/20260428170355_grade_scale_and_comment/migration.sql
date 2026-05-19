-- CreateEnum
CREATE TYPE "GradeScale" AS ENUM ('FIVE', 'TWELVE', 'HUNDRED', 'LETTER');

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "comment" VARCHAR(500),
ADD COLUMN     "scale" "GradeScale" NOT NULL DEFAULT 'FIVE';

-- CreateIndex
CREATE INDEX "Grade_status_idx" ON "Grade"("status");
