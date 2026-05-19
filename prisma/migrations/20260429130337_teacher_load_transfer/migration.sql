-- CreateTable
CREATE TABLE "TeacherLoadTransfer" (
    "id" TEXT NOT NULL,
    "fromTeacherId" TEXT NOT NULL,
    "toTeacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "reason" VARCHAR(500),
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transferredBy" TEXT NOT NULL,

    CONSTRAINT "TeacherLoadTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherLoadTransfer_toTeacherId_classId_subjectId_idx" ON "TeacherLoadTransfer"("toTeacherId", "classId", "subjectId");

-- CreateIndex
CREATE INDEX "TeacherLoadTransfer_fromTeacherId_classId_subjectId_idx" ON "TeacherLoadTransfer"("fromTeacherId", "classId", "subjectId");
