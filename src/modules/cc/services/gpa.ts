import { prisma } from '@/shared/lib/prisma';
import { calculateWeightedAverage } from '@/modules/grading/services/weighted-average';

export async function getOverallGpa(studentId: string): Promise<number | null> {
  const grades = await prisma.grade.findMany({
    where: {
      studentId,
      status: { not: 'draft' },
      scale: 'FIVE',
    },
    select: {
      value: true,
      category: { select: { weight: true } },
    },
  });

  if (grades.length === 0) return null;

  return calculateWeightedAverage(
    grades.map((grade) => ({
      value: grade.value,
      weight: grade.category.weight,
    })),
  );
}

