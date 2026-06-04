import { prisma } from '@/shared/lib/prisma';
import type { Role } from '@prisma/client';

/**
 * Зона доступа пользователя для AI-ассистента ядра.
 *
 * Scope резолвится из сессии на сервере и инфорсится в каждом туле
 * (см. tools.ts) НЕЗАВИСИМО от промпта — модель физически не может
 * получить данные вне своей зоны.
 *
 * Матрица (соответствует существующему RBAC приложения):
 *  - super_admin / analyst — всё (включая финансы и психолога)
 *  - zavuch — всё; финансы да (бухгалтерия по коду ADMIN_AND_VICE)
 *  - secretary — вся школа, без финансовой сводки и психолога
 *  - specialist (психолог/логопед/врач) — все ученики, псих/мед-данные да
 *  - teacher / curator — только свои классы (предметы + кураторство)
 *  - student — только сам
 *  - parent — только свои дети (+ их финансы)
 */
export interface AssistantScope {
  role: Role;
  userId: string;
  displayName: string;
  roleLabel: string;
  /** 'all' — без ограничений; иначе явные списки id */
  allowedClassIds: string[] | 'all';
  allowedStudentIds: string[] | 'all';
  canSeeFinance: boolean;
  canSeePsych: boolean;
  canSeeSchoolStats: boolean;
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Директор / администратор',
  analyst: 'Аналитик',
  zavuch: 'Завуч',
  secretary: 'Секретарь (ассистент директора)',
  teacher: 'Учитель',
  curator: 'Куратор класса',
  specialist: 'Специалист (психолог/логопед/врач)',
  student: 'Ученик',
  parent: 'Родитель',
};

interface SessionUser {
  id: string;
  login: string;
  role: string;
  starLevel: number;
}

export async function resolveScope(user: SessionUser): Promise<AssistantScope> {
  const role = user.role as Role;
  const base = {
    role,
    userId: user.id,
    displayName: user.login,
    roleLabel: ROLE_LABELS[role] ?? role,
  };

  switch (role) {
    case 'super_admin':
    case 'analyst':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: true, canSeePsych: true, canSeeSchoolStats: true };

    case 'zavuch':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: true, canSeePsych: true, canSeeSchoolStats: true };

    case 'secretary':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: false, canSeePsych: false, canSeeSchoolStats: true };

    case 'specialist':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: false, canSeePsych: true, canSeeSchoolStats: true };

    case 'teacher':
    case 'curator': {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: user.id },
        select: {
          firstName: true,
          lastName: true,
          curatorOf: { select: { id: true } },
          subjects: { select: { classId: true } },
        },
      });
      const classIds = new Set<string>();
      teacher?.curatorOf.forEach((c) => classIds.add(c.id));
      teacher?.subjects.forEach((s) => classIds.add(s.classId));
      const students = classIds.size
        ? await prisma.student.findMany({ where: { classId: { in: [...classIds] } }, select: { id: true } })
        : [];
      return {
        ...base,
        displayName: teacher ? `${teacher.firstName} ${teacher.lastName}` : user.login,
        allowedClassIds: [...classIds],
        allowedStudentIds: students.map((s) => s.id),
        canSeeFinance: false,
        canSeePsych: false,
        canSeeSchoolStats: false,
      };
    }

    case 'student': {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true, classId: true, firstName: true, lastName: true },
      });
      return {
        ...base,
        displayName: student ? `${student.firstName} ${student.lastName}` : user.login,
        allowedClassIds: student ? [student.classId] : [],
        allowedStudentIds: student ? [student.id] : [],
        canSeeFinance: true, // только свои инвойсы (scope режет по студенту)
        canSeePsych: false,
        canSeeSchoolStats: false,
      };
    }

    case 'parent': {
      const parent = await prisma.parent.findUnique({
        where: { userId: user.id },
        select: {
          firstName: true,
          lastName: true,
          children: { select: { student: { select: { id: true, classId: true } } } },
        },
      });
      const studentIds = parent?.children.map((c) => c.student.id) ?? [];
      const classIds = [...new Set(parent?.children.map((c) => c.student.classId) ?? [])];
      return {
        ...base,
        displayName: parent ? `${parent.firstName} ${parent.lastName}` : user.login,
        allowedClassIds: classIds,
        allowedStudentIds: studentIds,
        canSeeFinance: true, // только инвойсы своих детей
        canSeePsych: false,
        canSeeSchoolStats: false,
      };
    }

    default:
      return { ...base, allowedClassIds: [], allowedStudentIds: [], canSeeFinance: false, canSeePsych: false, canSeeSchoolStats: false };
  }
}

/** Проверка: ученик в зоне доступа? */
export function studentInScope(scope: AssistantScope, studentId: string): boolean {
  return scope.allowedStudentIds === 'all' || scope.allowedStudentIds.includes(studentId);
}

/** Проверка: класс в зоне доступа? */
export function classInScope(scope: AssistantScope, classId: string): boolean {
  return scope.allowedClassIds === 'all' || scope.allowedClassIds.includes(classId);
}
