import { type NextRequest } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { successResponse, errorResponse } from '@/shared/lib/api-response'
import { withAuth } from '@/shared/lib/api-auth'
import { canAccessStudent } from '@/shared/lib/student-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request)
    if (auth.response) return auth.response
    const role = auth.session.user.role
    const userId = auth.session.user.id

    const { id } = await params
    const allowed = await canAccessStudent(role, userId, id)
    if (!allowed) {
      return errorResponse('FORBIDDEN', 'Доступ запрещен', 403)
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            level: true,
            curator: true,
          },
        },
        parentLinks: {
          include: {
            parent: true,
          },
        },
        attendance: true,
        user: { select: { id: true } },
      },
    })

    if (!student) {
      return errorResponse('NOT_FOUND', 'Ученик не найден', 404)
    }

    // Доступ к карточке ученика по ID:
    // - student: только себя
    // - parent: только своих детей
    // - все остальные роли: разрешено
    // Compute attendance summary
    const attendanceSummary = {
      total: student.attendance.length,
      present: student.attendance.filter((a) => a.status === 'present').length,
      absent: student.attendance.filter((a) => a.status === 'absent').length,
      late: student.attendance.filter((a) => a.status === 'late').length,
      excused: student.attendance.filter((a) => a.status === 'excused').length,
    }

    // Remove raw attendance array, add summary
    const { attendance, ...studentData } = student
    const enriched = { ...studentData, attendanceSummary }

    // По ТЗ: 1★/2★/3★ доступ применяется только к данным педагога,
    // на странице ребёнка такая фильтрация не предусмотрена. Доступ к карточке
    // ребёнка ограничен ролью (parent → только свои дети, student → только себя),
    // эти проверки уже сделаны выше.

    return successResponse(enriched)
  } catch (error) {
    console.error('GET /api/v1/students/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Ошибка при получении данных ученика', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // По ТЗ: персональные данные ребёнка (анкету / медицинские) заполняет секретарь.
    // Завуч/аналитик/super_admin тоже могут (как «администратор»).
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
    })
    if (auth.response) return auth.response

    const { id } = await params
    const body = await request.json()

    const student = await prisma.student.findUnique({ where: { id } })
    if (!student) {
      return errorResponse('NOT_FOUND', 'Ученик не найден', 404)
    }

    const allowed = await canAccessStudent(auth.session.user.role, auth.session.user.id, id, auth.session.user.branchId)
    if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к ученику', 403)

    const updateData: Record<string, unknown> = {}

    if (body.familyData !== undefined) updateData.familyData = body.familyData
    if (body.medicalData !== undefined) updateData.medicalData = body.medicalData

    if (Object.keys(updateData).length === 0) {
      return errorResponse('BAD_REQUEST', 'Нет данных для обновления', 400)
    }

    const updated = await prisma.student.update({
      where: { id },
      data: updateData,
      include: {
        class: {
          include: {
            level: true,
            curator: true,
          },
        },
        parentLinks: {
          include: {
            parent: true,
          },
        },
      },
    })

    return successResponse(updated)
  } catch (error) {
    console.error('PUT /api/v1/students/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Ошибка при обновлении данных ученика', 500)
  }
}
