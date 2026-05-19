import { type NextRequest } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { successResponse, errorResponse } from '@/shared/lib/api-response'
import { withAuth } from '@/shared/lib/api-auth'

/**
 * GET /api/v1/me
 * Returns the currently authenticated user with role-specific identifiers
 * (teacherId / studentId / parentId) so the frontend can construct
 * scoped requests without extra round-trips.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request)
    if (auth.response) return auth.response

    const userId = auth.session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        login: true,
        email: true,
        role: true,
        starLevel: true,
        teacher: { select: { id: true, firstName: true, lastName: true, middleName: true, position: true } },
        student: { select: { id: true, firstName: true, lastName: true, classId: true } },
        parent: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    if (!user) {
      return errorResponse('NOT_FOUND', 'Пользователь не найден', 404)
    }

    return successResponse({
      id: user.id,
      login: user.login,
      email: user.email,
      role: user.role,
      starLevel: user.starLevel,
      teacherId: user.teacher?.id ?? null,
      teacher: user.teacher,
      studentId: user.student?.id ?? null,
      student: user.student,
      parentId: user.parent?.id ?? null,
      parent: user.parent,
    })
  } catch (error) {
    console.error('GET /api/v1/me error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить профиль', 500)
  }
}
