import { type NextRequest } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { successResponse, errorResponse } from '@/shared/lib/api-response'
import { withAuth } from '@/shared/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['zavuch', 'analyst', 'super_admin'],
    })
    if (auth.response) return auth.response

    const { searchParams } = request.nextUrl
    const gradeId = searchParams.get('gradeId')
    const studentId = searchParams.get('studentId')

    if (!gradeId && !studentId) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Необходимо указать gradeId или studentId',
      )
    }

    const where: Record<string, unknown> = {}

    if (gradeId) {
      where.gradeId = gradeId
    }

    if (studentId) {
      where.grade = { studentId }
    }

    const logs = await prisma.gradeAuditLog.findMany({
      where,
      include: {
        grade: {
          select: {
            id: true,
            value: true,
            studentId: true,
            subjectId: true,
            student: {
              select: { id: true, firstName: true, lastName: true },
            },
            subject: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(logs)
  } catch (error) {
    console.error('GET /api/v1/grading/audit error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить журнал аудита', 500)
  }
}
