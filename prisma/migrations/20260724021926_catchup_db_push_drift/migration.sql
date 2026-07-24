-- CreateEnum
CREATE TYPE "IncidentRole" AS ENUM ('initiator', 'victim', 'accomplice', 'witness');

-- CreateEnum
CREATE TYPE "BehaviorLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "SupervisionStatus" AS ENUM ('improved', 'no_change', 'needs_council');

-- CreateEnum
CREATE TYPE "PsyRisk" AS ENUM ('green', 'yellow', 'red');

-- CreateEnum
CREATE TYPE "PsyCaseStatus" AS ENUM ('new', 'in_progress', 'paused', 'closed');

-- CreateEnum
CREATE TYPE "PsySessionType" AS ENUM ('primary_diagnosis', 'planned', 'emergency', 'parent_meeting', 'teacher_meeting', 'group');

-- CreateEnum
CREATE TYPE "PsyCollabStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "PsyOutcome" AS ENUM ('in_progress', 'improved', 'repeat', 'referred');

-- CreateEnum
CREATE TYPE "PsyCaseStage" AS ENUM ('assessment', 'diagnosis', 'ips', 'intervention', 'review', 'closed');

-- CreateEnum
CREATE TYPE "PsySubject" AS ENUM ('student', 'parent', 'teacher', 'group');

-- CreateEnum
CREATE TYPE "PsyAlertStatus" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('reserve', 'interview', 'offer', 'hired', 'rejected');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'active', 'completed', 'cancelled');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CcExamType" ADD VALUE 'hsk';
ALTER TYPE "CcExamType" ADD VALUE 'other';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'founder';
ALTER TYPE "Role" ADD VALUE 'chief_accountant';
ALTER TYPE "Role" ADD VALUE 'finance_manager';
ALTER TYPE "Role" ADD VALUE 'senior_psychologist';
ALTER TYPE "Role" ADD VALUE 'psy_coordinator';
ALTER TYPE "Role" ADD VALUE 'safeguarding_lead';
ALTER TYPE "Role" ADD VALUE 'call_center';
ALTER TYPE "Role" ADD VALUE 'event_manager';
ALTER TYPE "Role" ADD VALUE 'sport_coordinator';
ALTER TYPE "Role" ADD VALUE 'media';
ALTER TYPE "Role" ADD VALUE 'zavuch_primary';
ALTER TYPE "Role" ADD VALUE 'zavuch_senior';
ALTER TYPE "Role" ADD VALUE 'zavuch_academic';
ALTER TYPE "Role" ADD VALUE 'cambridge_coord';
ALTER TYPE "Role" ADD VALUE 'olympiad_coach';
ALTER TYPE "Role" ADD VALUE 'club_coach';
ALTER TYPE "Role" ADD VALUE 'uniform_manager';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StudentStatus" ADD VALUE 'graduated';
ALTER TYPE "StudentStatus" ADD VALUE 'withdrawn';

-- DropForeignKey
ALTER TABLE "LibraryLoan" DROP CONSTRAINT "LibraryLoan_itemId_fkey";

-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "clubId" TEXT,
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "olympiadId" TEXT;

-- AlterTable
ALTER TABLE "AdmissionLead" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "psychCaseId" TEXT,
ADD COLUMN     "sentToPsych" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BehaviorIncident" ADD COLUMN     "level" "BehaviorLevel" NOT NULL DEFAULT 'low';

-- AlterTable
ALTER TABLE "CcApplication" ADD COLUMN     "requiredDocuments" TEXT,
ADD COLUMN     "requiredGpa" DOUBLE PRECISION,
ADD COLUMN     "requirementsNote" TEXT;

-- AlterTable
ALTER TABLE "CcExam" ADD COLUMN     "customExamName" TEXT;

-- AlterTable
ALTER TABLE "CcProfile" ADD COLUMN     "alumniAbroad" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "budgetThresholdUsd" INTEGER;

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "capacity" INTEGER;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "FeeInvoice" ADD COLUMN     "contractId" TEXT;

-- AlterTable
ALTER TABLE "LibraryLoan" ADD COLUMN     "classId" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "title" TEXT,
ALTER COLUMN "itemId" DROP NOT NULL,
ALTER COLUMN "dueAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Olympiad" ADD COLUMN     "allowedClasses" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "awardSchemeId" TEXT,
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "coachNotes" TEXT,
ADD COLUMN     "cost" INTEGER,
ADD COLUMN     "organizer" TEXT,
ADD COLUMN     "participationFormat" TEXT,
ADD COLUMN     "place" TEXT,
ADD COLUMN     "placeType" TEXT,
ADD COLUMN     "regDeadline" TIMESTAMP(3),
ADD COLUMN     "registrationUrl" TEXT,
ADD COLUMN     "resultsDate" TIMESTAMP(3),
ADD COLUMN     "status" TEXT DEFAULT 'announced',
ADD COLUMN     "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tours" JSONB;

-- AlterTable
ALTER TABLE "OlympiadParticipation" ADD COLUMN     "awardValue" TEXT,
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "enrolledAt" TIMESTAMP(3),
ADD COLUMN     "enrolledById" TEXT,
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT DEFAULT 'enrolled',
ADD COLUMN     "tour" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receiptKey" TEXT,
ADD COLUMN     "recordedBy" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- AlterTable
ALTER TABLE "SchoolEvent" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "report" TEXT;

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "isOlympian" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "psyCode" TEXT;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "data" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "telegramPendingRequest" TEXT;

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "requisites" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentNote" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "substituteTeacherId" TEXT,
    "reviewedById" TEXT,
    "signedRole" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherHours" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentParticipant" (
    "id" TEXT NOT NULL,
    "behaviorIncidentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "role" "IncidentRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionCase" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "behaviorIncidentId" TEXT,
    "reason" TEXT NOT NULL,
    "sessionsPlanned" INTEGER NOT NULL DEFAULT 3,
    "status" "SupervisionStatus" NOT NULL DEFAULT 'no_change',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monitoringUntil" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysNorm" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "grade" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhysNorm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyCase" (
    "id" TEXT NOT NULL,
    "subjectType" "PsySubject" NOT NULL DEFAULT 'student',
    "subjectId" TEXT,
    "subjectName" TEXT,
    "studentId" TEXT,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" VARCHAR(1000),
    "riskLevel" "PsyRisk" NOT NULL DEFAULT 'green',
    "riskJustification" VARCHAR(1000),
    "status" "PsyCaseStatus" NOT NULL DEFAULT 'new',
    "stage" "PsyCaseStage" NOT NULL DEFAULT 'assessment',
    "summary" TEXT,
    "courseRound" INTEGER NOT NULL DEFAULT 1,
    "outcome" "PsyOutcome" NOT NULL DEFAULT 'in_progress',
    "isIntake" BOOLEAN NOT NULL DEFAULT false,
    "intakeVerdict" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PsyCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyReferral" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsyReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyCaseCollaborator" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PsyCollabStatus" NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "PsyCaseCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsySession" (
    "interventionId" TEXT,
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "templateId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "PsySessionType" NOT NULL DEFAULT 'planned',
    "rawNote" TEXT,
    "dapData" TEXT,
    "dapAssessment" TEXT,
    "dapPlan" TEXT,
    "qualNote" TEXT,
    "aiDraft" JSONB,
    "isHumanVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "audioKey" TEXT,
    "audioSetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyDiagnosticTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentTemplateId" TEXT,
    "authorId" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "scaleConfig" JSONB,
    "mappingRule" JSONB,
    "gradeBand" TEXT,
    "direction" TEXT,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsyDiagnosticTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyTestResult" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sessionId" TEXT,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "rawScores" JSONB,
    "computedScales" JSONB,
    "imageKey" TEXT,
    "aiInterpretation" TEXT,
    "isHumanVerified" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsyTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyMeasurement" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "metric" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyScreeningCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "gradeBand" TEXT NOT NULL,
    "grade" INTEGER,
    "templateId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "branchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "riskThreshold" INTEGER,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsyScreeningCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyScreeningResult" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rawScores" JSONB,
    "score" INTEGER,
    "isRisk" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsyScreeningResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyAlert" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PsyAlertStatus" NOT NULL DEFAULT 'open',
    "takenBy" TEXT,
    "takenAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "remindCount" INTEGER NOT NULL DEFAULT 0,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyAiFeedback" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sessionId" TEXT,
    "rating" INTEGER NOT NULL,
    "source" TEXT,
    "comment" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsyAiFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyIps" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentIpsId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PsyIps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyIpsGoal" (
    "id" TEXT NOT NULL,
    "ipsId" TEXT NOT NULL,
    "specific" TEXT NOT NULL,
    "measurable" TEXT,
    "achievable" TEXT,
    "relevant" TEXT,
    "timeBound" TEXT,
    "deadline" TEXT NOT NULL,
    "directions" JSONB,
    "achieved" BOOLEAN NOT NULL DEFAULT false,
    "achievedAt" TIMESTAMP(3),

    CONSTRAINT "PsyIpsGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyIntervention" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "ipsId" TEXT NOT NULL,
    "plannedMeetings" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PsyIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vacancy" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'open',
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "position" TEXT NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'reserve',
    "resumeKey" TEXT,
    "note" TEXT,
    "vacancyId" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffContract" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "salary" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeOnboarding" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "inviteToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "data" JSONB,
    "staffId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryRecord" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRecord" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardScheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "branchId" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intensive" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" TEXT,
    "olympiadId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "coachId" TEXT NOT NULL,
    "branchId" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intensive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntensiveDay" (
    "id" TEXT NOT NULL,
    "intensiveId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntensiveDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntensiveParticipant" (
    "id" TEXT NOT NULL,
    "intensiveId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntensiveParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntensiveAttendance" (
    "id" TEXT NOT NULL,
    "intensiveId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "markedById" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntensiveAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" TEXT,
    "coachId" TEXT NOT NULL,
    "branchId" TEXT,
    "status" TEXT DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubSession" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubParticipant" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "distinguished" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClubParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubAttendance" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "markedById" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMetrics" (
    "id" TEXT NOT NULL,
    "intensiveId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tasksTotal" INTEGER,
    "tasksSolved" INTEGER,
    "attendedDays" INTEGER,
    "totalDays" INTEGER,
    "kpi" DOUBLE PRECISION,
    "kpiConfigVersion" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiConfig" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "w1" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "w2" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "w3" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniformItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT DEFAULT 'uniform',
    "categoryId" TEXT,
    "imageKey" TEXT,
    "basic" BOOLEAN NOT NULL DEFAULT false,
    "price" INTEGER DEFAULT 0,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniformItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniformCategory" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniformCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniformVariant" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UniformVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniformIssue" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "className" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "amount" INTEGER DEFAULT 0,
    "status" TEXT DEFAULT 'issued',
    "note" TEXT,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT,
    "paymentId" TEXT,

    CONSTRAINT "UniformIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "distinguished" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "activity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleFeedback" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorAppointment" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "studentName" TEXT,
    "desiredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsyAppointment" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'individual',
    "withType" TEXT NOT NULL,
    "withId" TEXT,
    "withName" TEXT,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "trainingType" TEXT,
    "note" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsyAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "branchId" TEXT,
    "year" TEXT NOT NULL,
    "baseAmount" INTEGER NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "discountNote" TEXT,
    "amount" INTEGER NOT NULL,
    "prepaymentPct" INTEGER NOT NULL DEFAULT 0,
    "scheduleType" "PaymentSchedule" NOT NULL DEFAULT 'monthly',
    "scheduleMonths" INTEGER NOT NULL DEFAULT 9,
    "paymentDay" INTEGER NOT NULL DEFAULT 10,
    "representative" JSONB,
    "requisites" JSONB,
    "status" "ContractStatus" NOT NULL DEFAULT 'active',
    "prevContractId" TEXT,
    "startDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassReserveEntry" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "leadId" TEXT,
    "childName" TEXT NOT NULL,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "desiredYear" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "branchId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassReserveEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDistribution" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "assetName" TEXT NOT NULL,
    "category" TEXT,
    "quantity" INTEGER NOT NULL,
    "amount" INTEGER,
    "destination" TEXT NOT NULL,
    "note" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" VARCHAR(1000),
    "location" TEXT,
    "date" TIMESTAMP(3),
    "priority" "IssuePriority" NOT NULL DEFAULT 'medium',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'open',
    "source" TEXT,
    "eventId" TEXT,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT,
    "requesterRole" TEXT,
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "items" TEXT,
    "amount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decisionNote" TEXT,
    "authorId" TEXT,
    "authorName" TEXT,
    "reviewedById" TEXT,
    "signedRole" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "forwardedById" TEXT,
    "forwardedRole" TEXT,
    "forwardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffLead" (
    "id" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactSchool" TEXT,
    "comment" TEXT,
    "standardModules" JSONB,
    "heavyModules" JSONB,
    "setupTotal" INTEGER,
    "licenseTotal" INTEGER,
    "schoolSize" TEXT,
    "pricingMode" TEXT,
    "presetId" TEXT,
    "selectedModules" JSONB,
    "weightTotal" DOUBLE PRECISION,
    "unitPrice" INTEGER,
    "annualLicence" INTEGER,
    "yearOne" INTEGER,
    "monthly" INTEGER,
    "aiInterest" BOOLEAN NOT NULL DEFAULT false,
    "pricingSnapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'new',
    "decisionNote" TEXT,
    "authorId" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TariffLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CcUniversity" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "program" TEXT,
    "costUsd" INTEGER,
    "requiredGpa" DOUBLE PRECISION,
    "requiredDocuments" TEXT,
    "requirementsNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CcUniversity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuleGrant_userId_idx" ON "ModuleGrant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleGrant_userId_module_key" ON "ModuleGrant"("userId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "Withdrawal_studentId_idx" ON "Withdrawal"("studentId");

-- CreateIndex
CREATE INDEX "StudentNote_studentId_createdAt_idx" ON "StudentNote"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "TimeOffRequest_teacherId_idx" ON "TimeOffRequest"("teacherId");

-- CreateIndex
CREATE INDEX "TimeOffRequest_status_idx" ON "TimeOffRequest"("status");

-- CreateIndex
CREATE INDEX "TeacherHours_teacherId_idx" ON "TeacherHours"("teacherId");

-- CreateIndex
CREATE INDEX "IncidentParticipant_studentId_idx" ON "IncidentParticipant"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentParticipant_behaviorIncidentId_studentId_key" ON "IncidentParticipant"("behaviorIncidentId", "studentId");

-- CreateIndex
CREATE INDEX "SupervisionCase_studentId_idx" ON "SupervisionCase"("studentId");

-- CreateIndex
CREATE INDEX "SupervisionCase_behaviorIncidentId_idx" ON "SupervisionCase"("behaviorIncidentId");

-- CreateIndex
CREATE INDEX "PhysNorm_studentId_idx" ON "PhysNorm"("studentId");

-- CreateIndex
CREATE INDEX "PsyCase_studentId_idx" ON "PsyCase"("studentId");

-- CreateIndex
CREATE INDEX "PsyCase_ownerId_idx" ON "PsyCase"("ownerId");

-- CreateIndex
CREATE INDEX "PsyCase_riskLevel_idx" ON "PsyCase"("riskLevel");

-- CreateIndex
CREATE INDEX "PsyReferral_caseId_idx" ON "PsyReferral"("caseId");

-- CreateIndex
CREATE INDEX "PsyCaseCollaborator_userId_idx" ON "PsyCaseCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PsyCaseCollaborator_caseId_userId_key" ON "PsyCaseCollaborator"("caseId", "userId");

-- CreateIndex
CREATE INDEX "PsySession_caseId_idx" ON "PsySession"("caseId");

-- CreateIndex
CREATE INDEX "PsySession_authorId_idx" ON "PsySession"("authorId");

-- CreateIndex
CREATE INDEX "PsySession_interventionId_idx" ON "PsySession"("interventionId");

-- CreateIndex
CREATE INDEX "PsyDiagnosticTemplate_parentTemplateId_idx" ON "PsyDiagnosticTemplate"("parentTemplateId");

-- CreateIndex
CREATE INDEX "PsyDiagnosticTemplate_isActive_idx" ON "PsyDiagnosticTemplate"("isActive");

-- CreateIndex
CREATE INDEX "PsyTestResult_caseId_idx" ON "PsyTestResult"("caseId");

-- CreateIndex
CREATE INDEX "PsyMeasurement_caseId_metric_idx" ON "PsyMeasurement"("caseId", "metric");

-- CreateIndex
CREATE INDEX "PsyScreeningCampaign_status_idx" ON "PsyScreeningCampaign"("status");

-- CreateIndex
CREATE INDEX "PsyScreeningCampaign_gradeBand_idx" ON "PsyScreeningCampaign"("gradeBand");

-- CreateIndex
CREATE INDEX "PsyScreeningResult_campaignId_isRisk_idx" ON "PsyScreeningResult"("campaignId", "isRisk");

-- CreateIndex
CREATE INDEX "PsyScreeningResult_studentId_idx" ON "PsyScreeningResult"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PsyScreeningResult_campaignId_studentId_key" ON "PsyScreeningResult"("campaignId", "studentId");

-- CreateIndex
CREATE INDEX "PsyAlert_status_idx" ON "PsyAlert"("status");

-- CreateIndex
CREATE INDEX "PsyAlert_caseId_idx" ON "PsyAlert"("caseId");

-- CreateIndex
CREATE INDEX "PsyAiFeedback_caseId_idx" ON "PsyAiFeedback"("caseId");

-- CreateIndex
CREATE INDEX "PsyIps_caseId_idx" ON "PsyIps"("caseId");

-- CreateIndex
CREATE INDEX "PsyIpsGoal_ipsId_idx" ON "PsyIpsGoal"("ipsId");

-- CreateIndex
CREATE INDEX "PsyIntervention_caseId_idx" ON "PsyIntervention"("caseId");

-- CreateIndex
CREATE INDEX "PsyIntervention_ipsId_idx" ON "PsyIntervention"("ipsId");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE INDEX "StaffContract_staffId_idx" ON "StaffContract"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeOnboarding_inviteToken_key" ON "EmployeeOnboarding"("inviteToken");

-- CreateIndex
CREATE INDEX "EmployeeOnboarding_status_idx" ON "EmployeeOnboarding"("status");

-- CreateIndex
CREATE INDEX "SalaryRecord_staffId_idx" ON "SalaryRecord"("staffId");

-- CreateIndex
CREATE INDEX "LeaveRecord_staffId_idx" ON "LeaveRecord"("staffId");

-- CreateIndex
CREATE INDEX "Intensive_olympiadId_idx" ON "Intensive"("olympiadId");

-- CreateIndex
CREATE INDEX "IntensiveDay_intensiveId_idx" ON "IntensiveDay"("intensiveId");

-- CreateIndex
CREATE UNIQUE INDEX "IntensiveDay_intensiveId_date_key" ON "IntensiveDay"("intensiveId", "date");

-- CreateIndex
CREATE INDEX "IntensiveParticipant_intensiveId_idx" ON "IntensiveParticipant"("intensiveId");

-- CreateIndex
CREATE INDEX "IntensiveParticipant_studentId_idx" ON "IntensiveParticipant"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "IntensiveParticipant_intensiveId_studentId_key" ON "IntensiveParticipant"("intensiveId", "studentId");

-- CreateIndex
CREATE INDEX "IntensiveAttendance_intensiveId_idx" ON "IntensiveAttendance"("intensiveId");

-- CreateIndex
CREATE INDEX "IntensiveAttendance_studentId_idx" ON "IntensiveAttendance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "IntensiveAttendance_intensiveId_studentId_date_key" ON "IntensiveAttendance"("intensiveId", "studentId", "date");

-- CreateIndex
CREATE INDEX "ClubSession_clubId_idx" ON "ClubSession"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubSession_clubId_date_key" ON "ClubSession"("clubId", "date");

-- CreateIndex
CREATE INDEX "ClubParticipant_clubId_idx" ON "ClubParticipant"("clubId");

-- CreateIndex
CREATE INDEX "ClubParticipant_studentId_idx" ON "ClubParticipant"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubParticipant_clubId_studentId_key" ON "ClubParticipant"("clubId", "studentId");

-- CreateIndex
CREATE INDEX "ClubAttendance_clubId_idx" ON "ClubAttendance"("clubId");

-- CreateIndex
CREATE INDEX "ClubAttendance_studentId_idx" ON "ClubAttendance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubAttendance_clubId_studentId_date_key" ON "ClubAttendance"("clubId", "studentId", "date");

-- CreateIndex
CREATE INDEX "StudentMetrics_intensiveId_idx" ON "StudentMetrics"("intensiveId");

-- CreateIndex
CREATE INDEX "StudentMetrics_studentId_idx" ON "StudentMetrics"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMetrics_intensiveId_studentId_key" ON "StudentMetrics"("intensiveId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiConfig_branchId_key" ON "KpiConfig"("branchId");

-- CreateIndex
CREATE INDEX "UniformItem_categoryId_idx" ON "UniformItem"("categoryId");

-- CreateIndex
CREATE INDEX "UniformCategory_branchId_idx" ON "UniformCategory"("branchId");

-- CreateIndex
CREATE INDEX "UniformVariant_itemId_idx" ON "UniformVariant"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "UniformVariant_itemId_size_key" ON "UniformVariant"("itemId", "size");

-- CreateIndex
CREATE INDEX "UniformIssue_itemId_idx" ON "UniformIssue"("itemId");

-- CreateIndex
CREATE INDEX "UniformIssue_studentId_idx" ON "UniformIssue"("studentId");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_idx" ON "EventParticipant"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_studentId_key" ON "EventParticipant"("eventId", "studentId");

-- CreateIndex
CREATE INDEX "RoleFeedback_studentId_idx" ON "RoleFeedback"("studentId");

-- CreateIndex
CREATE INDEX "DirectorAppointment_status_idx" ON "DirectorAppointment"("status");

-- CreateIndex
CREATE INDEX "DirectorAppointment_desiredAt_idx" ON "DirectorAppointment"("desiredAt");

-- CreateIndex
CREATE INDEX "PsyAppointment_psychologistId_at_idx" ON "PsyAppointment"("psychologistId", "at");

-- CreateIndex
CREATE INDEX "Contract_studentId_idx" ON "Contract"("studentId");

-- CreateIndex
CREATE INDEX "Contract_branchId_idx" ON "Contract"("branchId");

-- CreateIndex
CREATE INDEX "ClassReserveEntry_classId_position_idx" ON "ClassReserveEntry"("classId", "position");

-- CreateIndex
CREATE INDEX "AssetDistribution_createdAt_idx" ON "AssetDistribution"("createdAt");

-- CreateIndex
CREATE INDEX "MediaRequest_status_idx" ON "MediaRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_authorId_idx" ON "PurchaseRequest"("authorId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_createdAt_idx" ON "PurchaseRequest"("createdAt");

-- CreateIndex
CREATE INDEX "TariffLead_status_idx" ON "TariffLead"("status");

-- CreateIndex
CREATE INDEX "TariffLead_createdAt_idx" ON "TariffLead"("createdAt");

-- CreateIndex
CREATE INDEX "CcUniversity_branchId_idx" ON "CcUniversity"("branchId");

-- CreateIndex
CREATE INDEX "Achievement_eventId_idx" ON "Achievement"("eventId");

-- CreateIndex
CREATE INDEX "Achievement_olympiadId_idx" ON "Achievement"("olympiadId");

-- CreateIndex
CREATE INDEX "Achievement_clubId_idx" ON "Achievement"("clubId");

-- CreateIndex
CREATE INDEX "AdmissionLead_branchId_idx" ON "AdmissionLead"("branchId");

-- CreateIndex
CREATE INDEX "FeeInvoice_contractId_idx" ON "FeeInvoice"("contractId");

-- CreateIndex
CREATE INDEX "LibraryLoan_code_idx" ON "LibraryLoan"("code");

-- AddForeignKey
ALTER TABLE "ModuleGrant" ADD CONSTRAINT "ModuleGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentParticipant" ADD CONSTRAINT "IncidentParticipant_behaviorIncidentId_fkey" FOREIGN KEY ("behaviorIncidentId") REFERENCES "BehaviorIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentParticipant" ADD CONSTRAINT "IncidentParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionCase" ADD CONSTRAINT "SupervisionCase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionCase" ADD CONSTRAINT "SupervisionCase_behaviorIncidentId_fkey" FOREIGN KEY ("behaviorIncidentId") REFERENCES "BehaviorIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysNorm" ADD CONSTRAINT "PhysNorm_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoan" ADD CONSTRAINT "LibraryLoan_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistSession" ADD CONSTRAINT "SpecialistSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyReferral" ADD CONSTRAINT "PsyReferral_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PsyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyCaseCollaborator" ADD CONSTRAINT "PsyCaseCollaborator_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PsyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsySession" ADD CONSTRAINT "PsySession_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "PsyIntervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsySession" ADD CONSTRAINT "PsySession_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PsyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyTestResult" ADD CONSTRAINT "PsyTestResult_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PsyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyMeasurement" ADD CONSTRAINT "PsyMeasurement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PsyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyScreeningResult" ADD CONSTRAINT "PsyScreeningResult_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PsyScreeningCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyScreeningResult" ADD CONSTRAINT "PsyScreeningResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyAlert" ADD CONSTRAINT "PsyAlert_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PsyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyAiFeedback" ADD CONSTRAINT "PsyAiFeedback_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PsyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyIps" ADD CONSTRAINT "PsyIps_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PsyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyIpsGoal" ADD CONSTRAINT "PsyIpsGoal_ipsId_fkey" FOREIGN KEY ("ipsId") REFERENCES "PsyIps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyIntervention" ADD CONSTRAINT "PsyIntervention_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PsyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsyIntervention" ADD CONSTRAINT "PsyIntervention_ipsId_fkey" FOREIGN KEY ("ipsId") REFERENCES "PsyIps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Olympiad" ADD CONSTRAINT "Olympiad_awardSchemeId_fkey" FOREIGN KEY ("awardSchemeId") REFERENCES "AwardScheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intensive" ADD CONSTRAINT "Intensive_olympiadId_fkey" FOREIGN KEY ("olympiadId") REFERENCES "Olympiad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntensiveDay" ADD CONSTRAINT "IntensiveDay_intensiveId_fkey" FOREIGN KEY ("intensiveId") REFERENCES "Intensive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntensiveParticipant" ADD CONSTRAINT "IntensiveParticipant_intensiveId_fkey" FOREIGN KEY ("intensiveId") REFERENCES "Intensive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntensiveAttendance" ADD CONSTRAINT "IntensiveAttendance_intensiveId_fkey" FOREIGN KEY ("intensiveId") REFERENCES "Intensive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubSession" ADD CONSTRAINT "ClubSession_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubParticipant" ADD CONSTRAINT "ClubParticipant_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubAttendance" ADD CONSTRAINT "ClubAttendance_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMetrics" ADD CONSTRAINT "StudentMetrics_intensiveId_fkey" FOREIGN KEY ("intensiveId") REFERENCES "Intensive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniformVariant" ADD CONSTRAINT "UniformVariant_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "UniformItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniformIssue" ADD CONSTRAINT "UniformIssue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "UniformItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniformIssue" ADD CONSTRAINT "UniformIssue_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
