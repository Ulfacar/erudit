-- CreateEnum
CREATE TYPE "GroupTransferStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "GroupTransfer" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "fromGroupId" TEXT NOT NULL,
    "toGroupId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "status" "GroupTransferStatus" NOT NULL DEFAULT 'pending',
    "rejectReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "GroupTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupTransfer_classId_status_createdAt_idx" ON "GroupTransfer"("classId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GroupTransfer_studentId_idx" ON "GroupTransfer"("studentId");

-- AddForeignKey
ALTER TABLE "GroupTransfer" ADD CONSTRAINT "GroupTransfer_fromGroupId_fkey" FOREIGN KEY ("fromGroupId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTransfer" ADD CONSTRAINT "GroupTransfer_toGroupId_fkey" FOREIGN KEY ("toGroupId") REFERENCES "ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
