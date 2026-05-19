-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('pending', 'moderated', 'resolved');

-- CreateTable
CREATE TABLE "BehaviorIncident" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'pending',
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BehaviorIncident_studentId_createdAt_idx" ON "BehaviorIncident"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "BehaviorIncident" ADD CONSTRAINT "BehaviorIncident_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
