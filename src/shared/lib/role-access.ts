import type { Role } from '@prisma/client'

/**
 * Роли, наследующие доступ другой роли. Новые завучи действуют как `zavuch`
 * во всех проверках доступа (меню / RoleGate / API), без правки сотен файлов.
 * Ступень-скоупинг (младшие/старшие видят только свою ступень) — отдельный слой.
 */
export const ROLE_INHERITS: Partial<Record<Role, Role>> = {
  zavuch_primary: 'zavuch',
  zavuch_senior: 'zavuch',
  zavuch_academic: 'zavuch',
  cambridge_coord: 'zavuch',
  olympiad_coach: 'teacher',
  sport_coordinator: 'event_manager',
}

/** Эффективные роли пользователя: он сам + та, что он наследует. */
export function effectiveRoles(role: Role | null | undefined): Role[] {
  if (!role) return []
  const parent = ROLE_INHERITS[role]
  return parent ? [role, parent] : [role]
}

/** Совпадает ли роль (с учётом наследования) с разрешённым списком. */
export function roleMatches(allowed: Role[] | undefined, role: Role | null | undefined): boolean {
  if (!allowed || allowed.length === 0) return true
  if (!role) return false
  return effectiveRoles(role).some((r) => allowed.includes(r))
}
