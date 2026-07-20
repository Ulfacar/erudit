import type { BranchScope } from '@/shared/lib/branch-scope';
import { prisma } from '@/shared/lib/prisma';

/** Явно выданная профессиональная capability психослужбы (таблица ModuleGrant). */
export async function hasPsyCapability(userId: string, moduleName: string): Promise<boolean> {
  try {
    const grant = await prisma.moduleGrant.findUnique({
      where: { userId_module: { userId, module: moduleName } },
      select: { canRead: true },
    });
    return Boolean(grant?.canRead);
  } catch {
    return false;
  }
}

/** Capability «межфилиальный доступ в психослужбе». Хранится в существующей
 *  таблице ModuleGrant (module='psy_cross_branch', canRead=true) — миграция не нужна. */
export async function hasPsyCrossBranch(userId: string): Promise<boolean> {
  return hasPsyCapability(userId, 'psy_cross_branch');
}

/** Филиалы субъекта кейса. parent → branchId его детей (Student.branchId),
 *  teacher → branchId пользователя учителя (Teacher.user.branchId).
 *  Пустой массив = филиал определить не удалось. */
export async function subjectBranchIds(type: 'parent' | 'teacher', id: string): Promise<string[]> {
  if (type === 'parent') {
    const links = await prisma.parentStudent.findMany({
      where: { parentId: id },
      select: { student: { select: { branchId: true } } },
    });
    return [...new Set(links.map(({ student }) => student.branchId).filter((branchId): branchId is string => branchId !== null))];
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: { user: { select: { branchId: true } } },
  });
  return teacher?.user.branchId ? [teacher.user.branchId] : [];
}

/** Разрешён ли доступ к сущности указанных филиалов.
 *  Правила: crossBranch=true → всегда true; scope.canSeeAll → true;
 *  scope.closed → false; иначе scope.branchId ∈ branchIds. */
export function branchAllowed(scope: BranchScope, branchIds: string[], crossBranch: boolean): boolean {
  if (crossBranch) return true;
  if (scope.canSeeAll) return true;
  if (scope.closed) return false;
  return scope.branchId !== null && branchIds.includes(scope.branchId);
}
