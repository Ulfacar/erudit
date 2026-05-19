import { prisma } from '@/shared/lib/prisma';

/**
 * Calculate weighted average from an array of grade values with their category weights.
 * Only non-draft grades should be passed in.
 */
export function calculateWeightedAverage(
  grades: { value: number; weight: number }[],
): number {
  if (grades.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const g of grades) {
    weightedSum += g.value * g.weight;
    totalWeight += g.weight;
  }

  if (totalWeight === 0) return 0;

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/**
 * Get weighted averages for all students in a class for a given subject and period.
 * Groups by student, only includes grades where status != 'draft'.
 */
export async function getWeightedAveragesForClass(
  classId: string,
  subjectId: string,
  periodId: string,
): Promise<
  {
    studentId: string;
    studentName: string;
    weightedAverage: number;
    gradeCount: number;
  }[]
> {
  // Get all students in the class
  const students = await prisma.student.findMany({
    where: { classId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
    },
    orderBy: { lastName: 'asc' },
  });

  // Get all non-draft grades for this class/subject/period
  const grades = await prisma.grade.findMany({
    where: {
      subjectId,
      periodId,
      status: { not: 'draft' },
      student: { classId },
    },
    include: {
      category: {
        select: { weight: true },
      },
    },
  });

  // Group grades by student
  const gradesByStudent = new Map<
    string,
    { value: number; weight: number }[]
  >();
  for (const grade of grades) {
    const existing = gradesByStudent.get(grade.studentId) ?? [];
    existing.push({ value: grade.value, weight: grade.category.weight });
    gradesByStudent.set(grade.studentId, existing);
  }

  return students.map((student) => {
    const studentGrades = gradesByStudent.get(student.id) ?? [];
    const fullName = [student.lastName, student.firstName, student.middleName]
      .filter(Boolean)
      .join(' ');

    return {
      studentId: student.id,
      studentName: fullName,
      weightedAverage: calculateWeightedAverage(studentGrades),
      gradeCount: studentGrades.length,
    };
  });
}
