import { prisma } from '@/shared/lib/prisma'

export async function canAccessStudent(
  role: string,
  userId: string,
  studentId: string,
): Promise<boolean> {
  try {
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

    return true
  } catch {
    return false
  }
}
