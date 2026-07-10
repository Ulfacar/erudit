import { prisma } from '@/shared/lib/prisma'
import { getBranchScope } from '@/shared/lib/branch-scope'
import type { Role } from '@prisma/client'

const STAFF_ROLES: ReadonlySet<Role> = new Set([
  'super_admin',
  'analyst',
  'zavuch',
  'secretary',
  'teacher',
  'olympiad_coach',
  'uniform_manager',
  'curator',
  'specialist',
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
])

export async function canAccessStudent(
  role: string,
  userId: string,
  studentId: string,
  sessionBranchId?: string | null,
): Promise<boolean> {
  try {
    if (STAFF_ROLES.has(role as Role) || role === 'founder') {
      const scope = await getBranchScope(userId, role as Role, sessionBranchId)
      if (scope.canSeeAll) return true
      if (scope.closed || !scope.branchId) return false

      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { branchId: true },
      })

      return student?.branchId === scope.branchId
    }

    if (role === 'student') {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { user: { select: { id: true } } },
      })

      return student?.user?.id === userId
    }

    if (role === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { userId },
        select: {
          id: true,
          children: {
            where: { studentId },
            select: { studentId: true },
          },
        },
      })

      return Boolean(parent && parent.children.length > 0)
    }

    return false
  } catch {
    return false
  }
}
