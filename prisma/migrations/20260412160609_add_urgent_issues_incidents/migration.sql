-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('behavior', 'health', 'equipment', 'safety', 'other');

-- CreateTable
CREATE TABLE "UrgentIssue" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "IssuePriority" NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'open',
    "authorId" TEXT NOT NULL,
    "visibleTo" TEXT[],
    "classId" TEXT,
    "studentId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrgentIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "severity" "IssuePriority" NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'open',
    "authorId" TEXT NOT NULL,
    "classId" TEXT,
    "studentId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);
