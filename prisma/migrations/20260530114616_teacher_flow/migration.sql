-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "parentSignedAt" TIMESTAMP(3),
ADD COLUMN     "parentSignedBy" TEXT;

-- CreateTable
CREATE TABLE "LessonTopic" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "topic" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkCompletion" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonTopic_classId_subjectId_idx" ON "LessonTopic"("classId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonTopic_classId_subjectId_date_key" ON "LessonTopic"("classId", "subjectId", "date");

-- CreateIndex
CREATE INDEX "HomeworkCompletion_homeworkId_idx" ON "HomeworkCompletion"("homeworkId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkCompletion_homeworkId_studentId_key" ON "HomeworkCompletion"("homeworkId", "studentId");
