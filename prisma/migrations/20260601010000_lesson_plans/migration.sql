-- CreateTable
CREATE TABLE "LessonPlan" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT,
    "classId" TEXT,
    "topicId" TEXT,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 45,
    "objectives" VARCHAR(2000),
    "stages" JSONB NOT NULL,
    "homework" VARCHAR(2000),
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonPlan_teacherId_idx" ON "LessonPlan"("teacherId");
