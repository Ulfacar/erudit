import { type NextRequest } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { successResponse, errorResponse } from '@/shared/lib/api-response'
import { withAuth } from '@/shared/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request)
    if (auth.response) return auth.response

    const { id } = await params

    const grade = await prisma.grade.findUnique({
      where: { id },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, middleName: true },
        },
        subject: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true, weight: true },
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
        period: {
          select: { id: true, name: true },
        },
      },
    })

    if (!grade) {
      return errorResponse('NOT_FOUND', 'Оценка не найдена', 404)
    }

    // Ученик/родитель видят только СВОЮ опубликованную оценку (иначе — вытаскивание чужой по id).
    const role = auth.session.user.role
    if (role === 'student' || role === 'parent') {
      if (grade.status !== 'published') {
        return errorResponse('FORBIDDEN', 'Доступ запрещён', 403)
      }
      if (role === 'student') {
        const me = await prisma.student.findFirst({
          where: { userId: auth.session.user.id },
          select: { id: true },
        })
        if (!me || me.id !== grade.studentId) {
          return errorResponse('FORBIDDEN', 'Доступ запрещён', 403)
        }
      } else {
        const parent = await prisma.parent.findUnique({
          where: { userId: auth.session.user.id },
          select: { children: { select: { studentId: true } } },
        })
        const ok = parent?.children.some((c) => c.studentId === grade.studentId) ?? false
        if (!ok) {
          return errorResponse('FORBIDDEN', 'Доступ запрещён', 403)
        }
      }
    }

    return successResponse(grade)
  } catch (error) {
    console.error('GET /api/v1/grading/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить оценку', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request, {
      roles: ['teacher', 'curator', 'super_admin', 'zavuch'],
    })
    if (auth.response) return auth.response

    const { id } = await params
    const body = await request.json()
    const { value, status, scale, comment } = body as {
      value?: number
      status?: 'draft' | 'submitted' | 'moderated' | 'published'
      scale?: 'FIVE' | 'TWELVE' | 'HUNDRED' | 'LETTER'
      comment?: string | null
    }

    const existingGrade = await prisma.grade.findUnique({
      where: { id },
    })

    if (!existingGrade) {
      return errorResponse('NOT_FOUND', 'Оценка не найдена', 404)
    }

    const userRole = auth.session.user.role
    const isPrivileged =
      userRole === 'zavuch' || userRole === 'super_admin' || userRole === 'analyst'

    if (!isPrivileged) {
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
      const gradeAge = Date.now() - new Date(existingGrade.createdAt).getTime()
      if (gradeAge > TWENTY_FOUR_HOURS) {
        return errorResponse(
          'FORBIDDEN',
          'Окно редактирования (24 часа) истекло',
          403,
        )
      }
    }

    if (value !== undefined) {
      const effectiveScale = scale ?? existingGrade.scale
      const ranges: Record<string, [number, number]> = {
        FIVE: [1, 5],
        TWELVE: [1, 12],
        HUNDRED: [0, 100],
        LETTER: [0, 14],
      }
      const [min, max] = ranges[effectiveScale] ?? ranges.FIVE
      if (value < min || value > max) {
        return errorResponse(
          'VALIDATION_ERROR',
          `Оценка по шкале ${effectiveScale} должна быть от ${min} до ${max}`,
        )
      }
    }

    if (comment && comment.length > 500) {
      return errorResponse('VALIDATION_ERROR', 'Комментарий — не более 500 символов')
    }

    const updateData: Record<string, unknown> = {}
    if (value !== undefined) updateData.value = value
    if (status !== undefined) updateData.status = status
    if (scale !== undefined) updateData.scale = scale
    if (comment !== undefined) updateData.comment = comment

    const updatedGrade = await prisma.grade.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true },
        },
        category: {
          select: { id: true, name: true, weight: true },
        },
      },
    })

    // Write audit log for value changes
    if (value !== undefined && value !== existingGrade.value) {
      await prisma.gradeAuditLog.create({
        data: {
          gradeId: id,
          userId: auth.session.user.id,
          oldValue: existingGrade.value,
          newValue: value,
          action: 'updated',
        },
      })
    }

    return successResponse(updatedGrade)
  } catch (error) {
    console.error('PUT /api/v1/grading/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить оценку', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    })
    if (auth.response) return auth.response

    const { id } = await params

    const existingGrade = await prisma.grade.findUnique({
      where: { id },
    })

    if (!existingGrade) {
      return errorResponse('NOT_FOUND', 'Оценка не найдена', 404)
    }

    // Write audit log before deleting
    await prisma.gradeAuditLog.create({
      data: {
        gradeId: id,
        userId: auth.session.user.id,
        oldValue: existingGrade.value,
        newValue: null,
        action: 'deleted',
      },
    })

    await prisma.grade.delete({
      where: { id },
    })

    return successResponse({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/v1/grading/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить оценку', 500)
  }
}
