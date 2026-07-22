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

/**
 * Предметная нагрузка педагога: пары класс+предмет из TeacherSubject плюс
 * отдельно классы, где он куратор.
 *
 * В отличие от getTeacherScope здесь кураторство НЕ склеивается с предметной
 * нагрузкой: «классный руководитель» сам по себе не даёт права читать оценки по
 * чужим предметам своего класса — такого явного права в модели нет. Нужно для
 * чтения оценок и журнала; для расписания/посещаемости достаточно класса.
 */
export interface TeacherSubjectScope {
  teacherId: string;
  /** Пары, по которым педагог реально ведёт занятия. */
  pairs: Array<{ classId: string; subjectId: string }>;
  /** Классы, где педагог — куратор (без права на чужие предметы). */
  curatorClassIds: string[];
  /** Классы, куда педагогу вообще можно заглянуть: нагрузка ∪ кураторство. */
  classIds: string[];
}

export async function getTeacherSubjectScope(
  userId: string,
): Promise<TeacherSubjectScope | null> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: {
      id: true,
      subjects: { select: { classId: true, subjectId: true } },
      curatorOf: { select: { id: true } },
    },
  });
  if (!teacher) return null;

  const pairs = teacher.subjects.map((s) => ({ classId: s.classId, subjectId: s.subjectId }));
  const curatorClassIds = teacher.curatorOf.map((c) => c.id);
  const classIds = Array.from(
    new Set<string>([...pairs.map((p) => p.classId), ...curatorClassIds]),
  );

  return { teacherId: teacher.id, pairs, curatorClassIds, classIds };
}
