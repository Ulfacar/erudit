import { prisma } from '@/shared/lib/prisma';
import type { Role } from '@prisma/client';

/**
 * RLS для психологической службы (eSPSMS).
 *
 * Психолог видит ТОЛЬКО свои кейсы. Старший психолог и супер-админ видят все
 * кейсы (конструктор/эскалация/техдоступ). Энфорсить ТОЛЬКО server-side —
 * никогда не доверять ownerId/caseId из тела запроса.
 */

// Роли с полным доступом ко всем кейсам.
const FULL_ACCESS: Role[] = ['senior_psychologist', 'psy_coordinator', 'super_admin'];

// Роли, которые могут вести кейсы (быть owner).
export const CASE_OWNER_ROLES: Role[] = ['psychologist', 'senior_psychologist', 'specialist'];

// Роли, видящие кабинет психолога целиком.
export const PSY_CABINET_ROLES: Role[] = ['psychologist', 'senior_psychologist', 'psy_coordinator', 'specialist', 'super_admin'];

export interface PsyScope {
  userId: string;
  role: Role;
  full: boolean;
}

export function getPsyScope(userId: string, role: Role): PsyScope {
  return { userId, role, full: FULL_ACCESS.includes(role) };
}

export function canSeeFio(scope: PsyScope, ownerId: string): boolean {
  if (scope.role === 'psy_coordinator' || scope.role === 'super_admin') return true;
  if (scope.role === 'senior_psychologist') return false;
  return ownerId === scope.userId;
}

export function subjectDisplay(
  scope: PsyScope,
  c: { id: string; subjectType: string; ownerId: string; subjectName: string | null },
  student: { firstName: string; lastName: string; middleName: string | null; psyCode: string | null } | null,
): string {
  const fio = canSeeFio(scope, c.ownerId);
  if (c.subjectType === 'student') {
    if (fio && student) return `${student.lastName} ${student.firstName}`.trim();
    return student?.psyCode ?? 'код скрыт';
  }
  if (fio) return c.subjectName ?? '—';
  return `К-${c.id.slice(-6).toUpperCase()}`;
}

/** Prisma where-фильтр для списка кейсов под RLS текущего пользователя. */
export async function caseWhereForScope(scope: PsyScope): Promise<Record<string, unknown>> {
  if (scope.full) return {};
  return { ownerId: scope.userId };
}

/** Может ли пользователь видеть/редактировать конкретный кейс. */
export async function canAccessCase(scope: PsyScope, caseId: string): Promise<boolean> {
  if (scope.full) return true;
  const c = await prisma.psyCase.findUnique({ where: { id: caseId }, select: { ownerId: true } });
  return c?.ownerId === scope.userId;
}
