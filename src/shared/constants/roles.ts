import type { Role } from '@prisma/client'

/**
 * Source of truth — Prisma `Role` enum (9 lowercase roles).
 * Re-exported here as a type alias for convenience and as a frozen
 * tuple for iteration/validation.
 */
export type AppRole = Role

export const ALL_ROLES: AppRole[] = [
  'super_admin',
  'analyst',
  'zavuch',
  'secretary',
  'teacher',
  'curator',
  'specialist',
  'student',
  'parent',
  'accountant',
  'psychologist',
  'doctor',
  'hr',
  'librarian',
  'cook',
  'zavhoz',
  'senior_psychologist',
  'safeguarding_lead',
  'call_center',
  'event_manager',
]

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Суперадмин',
  analyst: 'Аналитик',
  zavuch: 'Завуч',
  secretary: 'Секретарь',
  teacher: 'Педагог',
  curator: 'Куратор',
  specialist: 'Специалист',
  student: 'Ученик',
  parent: 'Родитель',
  accountant: 'Бухгалтер',
  psychologist: 'Психолог',
  doctor: 'Врач',
  hr: 'Кадровик',
  librarian: 'Библиотекарь',
  cook: 'Повар',
  zavhoz: 'Завхоз',
  senior_psychologist: 'Старший психолог',
  safeguarding_lead: 'Координатор безопасности',
  call_center: 'Колл-центр',
  event_manager: 'Ивент-менеджер',
}

export const ADMIN_ROLES: AppRole[] = ['super_admin', 'analyst']
export const ADMIN_AND_VICE: AppRole[] = ['super_admin', 'analyst', 'zavuch']
export const STAFF_ROLES: AppRole[] = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator']
export const TEACHING_ROLES: AppRole[] = ['teacher', 'curator']

export function isAdminRole(role: string | null | undefined): role is AppRole {
  return role !== null && role !== undefined && ADMIN_ROLES.includes(role as AppRole)
}

export function isStaffRole(role: string | null | undefined): role is AppRole {
  return role !== null && role !== undefined && STAFF_ROLES.includes(role as AppRole)
}
