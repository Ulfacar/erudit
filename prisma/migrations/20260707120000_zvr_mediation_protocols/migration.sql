-- CreateEnum
CREATE TYPE "MediationParty" AS ENUM ('student', 'parent');

-- CreateTable
CREATE TABLE "MediationProtocol" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "behaviorIncidentId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agreement" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediationProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediationObligation" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "party" "MediationParty" NOT NULL,
    "task" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediationObligation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediationProtocol_studentId_idx" ON "MediationProtocol"("studentId");

-- CreateIndex
CREATE INDEX "MediationProtocol_behaviorIncidentId_idx" ON "MediationProtocol"("behaviorIncidentId");

-- CreateIndex
CREATE INDEX "MediationObligation_protocolId_idx" ON "MediationObligation"("protocolId");

-- AddForeignKey
ALTER TABLE "MediationProtocol" ADD CONSTRAINT "MediationProtocol_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediationProtocol" ADD CONSTRAINT "MediationProtocol_behaviorIncidentId_fkey" FOREIGN KEY ("behaviorIncidentId") REFERENCES "BehaviorIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediationObligation" ADD CONSTRAINT "MediationObligation_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "MediationProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
