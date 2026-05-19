-- CreateTable
CREATE TABLE "TeacherDescriptor" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "accessLevel" INTEGER NOT NULL DEFAULT 1,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherDescriptor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherDescriptor_teacherId_year_idx" ON "TeacherDescriptor"("teacherId", "year");

-- CreateIndex
CREATE INDEX "TeacherDescriptor_accessLevel_idx" ON "TeacherDescriptor"("accessLevel");

-- AddForeignKey
ALTER TABLE "TeacherDescriptor" ADD CONSTRAINT "TeacherDescriptor_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
