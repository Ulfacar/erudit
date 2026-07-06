-- CreateEnum
CREATE TYPE "CcConflictStatus" AS ENUM ('green', 'yellow', 'red');

-- CreateEnum
CREATE TYPE "CcExamType" AS ENUM ('sat', 'ielts', 'toefl', 'ort', 'csca', 'opt');

-- CreateEnum
CREATE TYPE "CcApplicationType" AS ENUM ('early_action', 'early_decision', 'regular_decision');

-- CreateEnum
CREATE TYPE "CcAdmissionStatus" AS ENUM ('scouting', 'document_prep', 'submitted', 'decision_pending', 'offer_received', 'rejected', 'accepted_final');

-- CreateEnum
CREATE TYPE "CcDocType" AS ENUM ('personal_statement', 'essay', 'cv', 'brag_sheet', 'recommendation', 'portfolio', 'transcript', 'passport', 'other');

-- CreateEnum
CREATE TYPE "CcDocStatus" AS ENUM ('not_started', 'draft', 'in_review', 'ready', 'received');

-- CreateTable
CREATE TABLE "CcProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "counselorId" TEXT,
    "branchId" TEXT,
    "studentCountries" TEXT[],
    "studentMajor" TEXT,
    "studentMotivation" TEXT,
    "parentCountries" TEXT[],
    "parentBudgetUsd" INTEGER,
    "parentMajor" TEXT,
    "parentSafety" BOOLEAN NOT NULL DEFAULT false,
    "parentExpectations" TEXT,
    "conflictStatus" "CcConflictStatus" NOT NULL DEFAULT 'green',
    "conflictComputedAt" TIMESTAMP(3),
    "riskFlagCleared" BOOLEAN NOT NULL DEFAULT false,
    "counselorComment" TEXT,
    "strategyAssigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CcProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CcExam" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "examType" "CcExamType" NOT NULL,
    "testDate" TIMESTAMP(3),
    "scoreCurrent" DOUBLE PRECISION,
    "scoreTarget" DOUBLE PRECISION,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "certificateUrl" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CcExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CcApplication" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "universityName" TEXT NOT NULL,
    "country" TEXT,
    "program" TEXT,
    "applicationType" "CcApplicationType",
    "admissionStatus" "CcAdmissionStatus" NOT NULL DEFAULT 'scouting',
    "deadlineDate" TIMESTAMP(3),
    "decisionDate" TIMESTAMP(3),
    "applicationId" TEXT,
    "submissionProof" TEXT,
    "scholarshipAmount" TEXT,
    "scholarshipType" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CcApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CcDocument" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "docType" "CcDocType" NOT NULL,
    "status" "CcDocStatus" NOT NULL DEFAULT 'not_started',
    "fileUrl" TEXT,
    "teacherId" TEXT,
    "requestedDeadline" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "requiredCount" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CcDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CcMeeting" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "counselorId" TEXT,
    "meetingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topic" TEXT,
    "notes" TEXT,
    "actionItems" TEXT,
    "format" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CcMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CcProfile_studentId_key" ON "CcProfile"("studentId");

-- CreateIndex
CREATE INDEX "CcProfile_counselorId_idx" ON "CcProfile"("counselorId");

-- CreateIndex
CREATE INDEX "CcProfile_conflictStatus_idx" ON "CcProfile"("conflictStatus");

-- CreateIndex
CREATE INDEX "CcProfile_branchId_idx" ON "CcProfile"("branchId");

-- CreateIndex
CREATE INDEX "CcExam_profileId_idx" ON "CcExam"("profileId");

-- CreateIndex
CREATE INDEX "CcApplication_profileId_idx" ON "CcApplication"("profileId");

-- CreateIndex
CREATE INDEX "CcApplication_admissionStatus_idx" ON "CcApplication"("admissionStatus");

-- CreateIndex
CREATE INDEX "CcApplication_deadlineDate_idx" ON "CcApplication"("deadlineDate");

-- CreateIndex
CREATE INDEX "CcDocument_profileId_idx" ON "CcDocument"("profileId");

-- CreateIndex
CREATE INDEX "CcMeeting_profileId_idx" ON "CcMeeting"("profileId");

-- AddForeignKey
ALTER TABLE "CcProfile" ADD CONSTRAINT "CcProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcExam" ADD CONSTRAINT "CcExam_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CcProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcApplication" ADD CONSTRAINT "CcApplication_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CcProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcDocument" ADD CONSTRAINT "CcDocument_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CcProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CcMeeting" ADD CONSTRAINT "CcMeeting_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CcProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
