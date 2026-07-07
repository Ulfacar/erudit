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
  /** какие виды спец-данных доступны: психолог — только psych, врач — только medical */
  allowedSpecialistKinds: Array<'speech' | 'psych' | 'medical'> | 'all';
  canSeeSchoolStats: boolean;
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Директор / администратор',
  founder: 'Учредитель',
  analyst: 'Аналитик',
  zavuch: 'Завуч',
  secretary: 'Секретарь (ассистент директора)',
  teacher: 'Учитель',
  curator: 'Куратор класса',
  specialist: 'Специалист (психолог/логопед/врач)',
  student: 'Ученик',
  parent: 'Родитель',
  accountant: 'Кассир',
  chief_accountant: 'Бухгалтер',
  finance_manager: 'Финменеджер',
  psychologist: 'Психолог',
  doctor: 'Врач',
  hr: 'Кадровик (HR)',
  librarian: 'Библиотекарь',
  cook: 'Повар (столовая)',
  zavhoz: 'Завхоз (АХЧ)',
  senior_psychologist: 'Старший психолог',
  psy_coordinator: 'Координатор ПС',
  safeguarding_lead: 'Завуч по воспитательной работе',
  call_center: 'Колл-центр',
  event_manager: 'Ивент-менеджер',
  media: 'Медиа-центр',
  zavuch_primary: 'Завуч по младшим классам',
  zavuch_senior: 'Завуч по старшим классам',
  zavuch_academic: 'Завуч по учебной части',
  cambridge_coord: 'Кэмбридж-координатор',
  college_counselor: 'Колледж-консультант',
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
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: true, canSeePsych: true, allowedSpecialistKinds: 'all', canSeeSchoolStats: true };

    case 'founder':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: true, canSeePsych: false, allowedSpecialistKinds: [], canSeeSchoolStats: true };

    case 'zavuch':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: true, canSeePsych: true, allowedSpecialistKinds: 'all', canSeeSchoolStats: true };

    case 'secretary':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: false, canSeePsych: false, allowedSpecialistKinds: [], canSeeSchoolStats: true };

    case 'specialist':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: false, canSeePsych: true, allowedSpecialistKinds: 'all', canSeeSchoolStats: true };

    // ── Узкие роли сотрудников: каждый видит свой домен ──
    case 'accountant':
    case 'chief_accountant':
    case 'finance_manager':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: true, canSeePsych: false, allowedSpecialistKinds: [], canSeeSchoolStats: true };

    case 'psychologist':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: false, canSeePsych: true, allowedSpecialistKinds: ['psych'], canSeeSchoolStats: true };

    case 'psy_coordinator':
      return {
        ...base,
        allowedClassIds: 'all',
        allowedStudentIds: 'all',
        canSeeFinance: false,
        canSeePsych: true,
        allowedSpecialistKinds: ['psych'],
        canSeeSchoolStats: true,
      }
    case 'senior_psychologist':
      // старший психолог: весь психо-домен + школьная статистика (конструктор, дашборд)
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: false, canSeePsych: true, allowedSpecialistKinds: ['psych'], canSeeSchoolStats: true };

    case 'safeguarding_lead':
      // координатор безопасности: видит психо-контекст для реагирования на алерты + статистику
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: false, canSeePsych: true, allowedSpecialistKinds: ['psych'], canSeeSchoolStats: true };

    case 'call_center':
      // колл-центр: финансовый домен (должники/обещания), без психо-данных
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: true, canSeePsych: false, allowedSpecialistKinds: [], canSeeSchoolStats: true };

    case 'media':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: false, canSeePsych: false, allowedSpecialistKinds: [], canSeeSchoolStats: true };

    case 'doctor':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: false, canSeePsych: true, allowedSpecialistKinds: ['medical'], canSeeSchoolStats: true };

    case 'hr':
      return { ...base, allowedClassIds: 'all', allowedStudentIds: 'all', canSeeFinance: false, canSeePsych: false, allowedSpecialistKinds: [], canSeeSchoolStats: true };

    case 'librarian':
    case 'cook':
    case 'zavhoz':
      // хозблок: профили учеников не нужны — ассистент отвечает по базе знаний и своим модулям
      return { ...base, allowedClassIds: [], allowedStudentIds: [], canSeeFinance: false, canSeePsych: false, allowedSpecialistKinds: [], canSeeSchoolStats: false };

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
        allowedSpecialistKinds: [],
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
        allowedSpecialistKinds: [],
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
        allowedSpecialistKinds: [],
        canSeeSchoolStats: false,
      };
    }

    default:
      return { ...base, allowedClassIds: [], allowedStudentIds: [], canSeeFinance: false, canSeePsych: false, allowedSpecialistKinds: [], canSeeSchoolStats: false };
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
