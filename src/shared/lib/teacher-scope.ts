import { prisma } from '@/shared/lib/prisma';

/**
 * Область видимости учителя: его teacherId и множество «своих» классов
 * (где он ведёт предмет ИЛИ является куратором).
 *
 * Единый источник правды для privacy-фильтров (расписание, замены, оценки).
 * Энфорсить ТОЛЬКО server-side — никогда не доверять classId/teacherId из query.
 */
export interface TeacherScope {
  teacherId: string;
  classIds: string[];
}

export async function getTeacherScope(userId: string): Promise<TeacherScope | null> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: {
      id: true,
      subjects: { select: { classId: true } },
      curatorOf: { select: { id: true } },
    },
  });
  if (!teacher) return null;

  const classIds = Array.from(
    new Set<string>([
      ...teacher.subjects.map((s) => s.classId),
      ...teacher.curatorOf.map((c) => c.id),
    ]),
  );

  return { teacherId: teacher.id, classIds };
}
