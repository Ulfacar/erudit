import type { Role } from '@prisma/client'
import { ALL_ROLES, ROLE_LABELS, type AppRole } from './roles'

export interface RoleClusterItem {
  role: AppRole
  emoji: string
  color: string
  demoLogin?: string
}

export interface RoleCluster {
  id: string
  label: string
  shortLabel: string
  emoji: string
  color: string
  azimuthDeg: number
  roles: RoleClusterItem[]
}

export const CLUSTERS = [
  {
    id: 'upravlenie',
    label: 'Управление',
    shortLabel: 'Управление',
    emoji: '🏛️',
    color: '#ffd43b',
    azimuthDeg: 90,
    roles: [
      { role: 'super_admin', emoji: '🏫', color: '#1c7ed6', demoLogin: 'admin' },
      { role: 'founder', emoji: '🏛️', color: '#5f3dc4', demoLogin: 'founder1' },
      { role: 'analyst', emoji: '🔎', color: '#0c8599', demoLogin: 'analyst1' },
      { role: 'secretary', emoji: '🗂️', color: '#1098ad', demoLogin: 'secretary1' },
    ],
  },
  {
    id: 'uchebka',
    label: 'Учебная часть',
    shortLabel: 'Учебка',
    emoji: '🎓',
    color: '#845ef7',
    azimuthDeg: 45,
    roles: [
      { role: 'zavuch', emoji: '🧭', color: '#7048e8' },
      { role: 'zavuch_primary', emoji: '🧒', color: '#1c7ed6', demoLogin: 'zavuch_primary1' },
      { role: 'zavuch_senior', emoji: '🎓', color: '#1c7ed6', demoLogin: 'zavuch_senior1' },
      { role: 'zavuch_academic', emoji: '📚', color: '#3b5bdb', demoLogin: 'zavuch_academic1' },
      { role: 'cambridge_coord', emoji: '🌐', color: '#7048e8', demoLogin: 'cambridge1' },
    ],
  },
  {
    id: 'pedagogi',
    label: 'Педагоги',
    shortLabel: 'Педагоги',
    emoji: '👩‍🏫',
    color: '#ff922b',
    azimuthDeg: 0,
    roles: [
      { role: 'teacher', emoji: '👩‍🏫', color: '#7048e8', demoLogin: 'matematik' },
      { role: 'curator', emoji: '🧑‍🏫', color: '#9775fa' },
      { role: 'specialist', emoji: '🎯', color: '#0ca678' },
      { role: 'olympiad_coach', emoji: '🏅', color: '#f08c00', demoLogin: 'olympcoach1' },
    ],
  },
  {
    id: 'semya',
    label: 'Ученики и семья',
    shortLabel: 'Семья',
    emoji: '🎒',
    color: '#51cf66',
    azimuthDeg: 315,
    roles: [
      { role: 'student', emoji: '🎒', color: '#0ca678', demoLogin: 'student1' },
      { role: 'parent', emoji: '👨‍👩‍👧', color: '#e8590c', demoLogin: 'parent1' },
    ],
  },
  {
    id: 'finansy',
    label: 'Финансы',
    shortLabel: 'Финансы',
    emoji: '💰',
    color: '#ff6b6b',
    azimuthDeg: 270,
    roles: [
      { role: 'accountant', emoji: '💰', color: '#e8590c', demoLogin: 'accountant1' },
      { role: 'chief_accountant', emoji: '📊', color: '#2b8a3e', demoLogin: 'chief_accountant1' },
      { role: 'finance_manager', emoji: '📈', color: '#1864ab', demoLogin: 'finance_manager1' },
      { role: 'call_center', emoji: '🎧', color: '#1971c2', demoLogin: 'callcenter1' },
    ],
  },
  {
    id: 'psy',
    label: 'Психология и забота',
    shortLabel: 'Психология',
    emoji: '🧠',
    color: '#cc5de8',
    azimuthDeg: 225,
    roles: [
      { role: 'psychologist', emoji: '🧠', color: '#9c36b5', demoLogin: 'psychologist1' },
      { role: 'senior_psychologist', emoji: '🧩', color: '#ae3ec9', demoLogin: 'senior_psy' },
      { role: 'doctor', emoji: '🩺', color: '#e03131', demoLogin: 'doctor1' },
      { role: 'safeguarding_lead', emoji: '🎭', color: '#e8590c', demoLogin: 'safeguard' },
    ],
  },
  {
    id: 'hoz',
    label: 'Хозяйство и кадры',
    shortLabel: 'Хозяйство',
    emoji: '🔧',
    color: '#4dabf7',
    azimuthDeg: 180,
    roles: [
      { role: 'hr', emoji: '📋', color: '#2f9e44', demoLogin: 'hr1' },
      { role: 'librarian', emoji: '📚', color: '#1971c2', demoLogin: 'librarian1' },
      { role: 'cook', emoji: '🍲', color: '#f08c00', demoLogin: 'cook1' },
      { role: 'zavhoz', emoji: '🔧', color: '#495057', demoLogin: 'zavhoz1' },
      { role: 'uniform_manager', emoji: '🧥', color: '#e8590c', demoLogin: 'uniform1' },
    ],
  },
  {
    id: 'spec',
    label: 'Спец-направления',
    shortLabel: 'Спец',
    emoji: '🎬',
    color: '#22b8cf',
    azimuthDeg: 135,
    roles: [
      { role: 'event_manager', emoji: '🎉', color: '#e64980', demoLogin: 'event1' },
      { role: 'media', emoji: '🎬', color: '#c2255c', demoLogin: 'media1' },
      { role: 'college_counselor', emoji: '🗺️', color: '#1971c2', demoLogin: 'counselor' },
    ],
  },
] as const satisfies readonly RoleCluster[]

export const ROLE_CLUSTERS = CLUSTERS

export const ROLE_TO_CLUSTER = Object.fromEntries(
  CLUSTERS.flatMap((cluster) => cluster.roles.map((item) => [item.role, cluster])),
) as Record<string, RoleCluster>

export const ROLE_META = Object.fromEntries(
  CLUSTERS.flatMap((cluster) => cluster.roles.map((item) => [item.role, item])),
) as Record<string, RoleClusterItem>

export function getRoleCluster(role: Role | AppRole): RoleCluster {
  return ROLE_TO_CLUSTER[role as AppRole]
}

export function getRoleMeta(role: Role | AppRole): RoleClusterItem {
  return ROLE_META[role as AppRole]
}

export function getClusterById(id: string): RoleCluster | undefined {
  return CLUSTERS.find((cluster) => cluster.id === id)
}

export function getRoleLabel(role: Role | AppRole): string {
  return ROLE_LABELS[role as AppRole]
}

export const ROLE_CLUSTER_TOTAL = CLUSTERS.reduce((sum, cluster) => sum + cluster.roles.length, 0)

const clusteredRoles = new Set<string>(CLUSTERS.flatMap((cluster) => cluster.roles.map((item) => item.role)))
if (process.env.NODE_ENV !== 'production') {
  const missing = ALL_ROLES.filter((role) => !clusteredRoles.has(role))
  if (missing.length > 0) {
    console.warn(`[role-clusters] Не описаны роли: ${missing.join(', ')}`)
  }
}
