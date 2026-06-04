-- CreateEnum
CREATE TYPE "AdmissionStage" AS ENUM ('lead', 'testing', 'psych', 'director', 'contract', 'enrolled', 'rejected');

-- CreateEnum
CREATE TYPE "PaymentSchedule" AS ENUM ('monthly', 'quarterly', 'yearly');

-- CreateTable
CREATE TABLE "AssistantConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Новый диалог',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" VARCHAR(8000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionLead" (
    "id" TEXT NOT NULL,
    "stage" "AdmissionStage" NOT NULL DEFAULT 'lead',
    "childName" TEXT NOT NULL,
    "targetGrade" INTEGER NOT NULL,
    "parentName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" TEXT,
    "mathScore" INTEGER,
    "englishScore" INTEGER,
    "psychNote" VARCHAR(2000),
    "decisionNote" VARCHAR(1000),
    "contractAmount" INTEGER,
    "paymentSchedule" "PaymentSchedule",
    "rejectReason" VARCHAR(1000),
    "enrolledStudentId" TEXT,
    "classId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantConversation_userId_updatedAt_idx" ON "AssistantConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AssistantMessage_conversationId_createdAt_idx" ON "AssistantMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AdmissionLead_stage_updatedAt_idx" ON "AdmissionLead"("stage", "updatedAt");

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
