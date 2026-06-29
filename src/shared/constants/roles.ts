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
  'chief_accountant',
  'finance_manager',
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
  'zavuch_primary',
  'zavuch_senior',
  'zavuch_academic',
  'cambridge_coord',
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
  accountant: 'Кассир',
  chief_accountant: 'Бухгалтер',
  finance_manager: 'Финменеджер',
  psychologist: 'Психолог',
  doctor: 'Врач',
  hr: 'Кадровик',
  librarian: 'Библиотекарь',
  cook: 'Повар',
  zavhoz: 'Завхоз',
  senior_psychologist: 'Старший психолог',
  safeguarding_lead: 'Завуч по воспитательной работе',
  call_center: 'Колл-центр',
  event_manager: 'Ивент-менеджер',
  zavuch_primary: 'Завуч по младшим классам',
  zavuch_senior: 'Завуч по старшим классам',
  zavuch_academic: 'Завуч по учебной части',
  cambridge_coord: 'Кэмбридж-координатор',
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
