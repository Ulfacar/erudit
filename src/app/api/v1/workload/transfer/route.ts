import { type NextRequest } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { successResponse, errorResponse } from '@/shared/lib/api-response'
import { withAuth } from '@/shared/lib/api-auth'

/**
 * POST /api/v1/workload/transfer
 *
 * Передача нагрузки одного учителя другому (по ТЗ — декрет, болезнь, замена).
 *
 * Body: { fromTeacherId, toTeacherId, subjectId, classId, reason? }
 *
 * Действие:
 *   1) Создаёт запись TeacherLoadTransfer (фиксирует момент передачи).
 *   2) Перепривязывает TeacherSubject от fromTeacher к toTeacher (если уже есть у нового —
 *      объединяет hoursPerWeek; если нет — создаёт).
 *   3) Старые оценки/scheduleEntries за прошлый период остаются у fromTeacher
 *      и видны новому учителю в read-only режиме через GET ниже.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    })
    if (auth.response) return auth.response

    const body = await request.json()
    const { fromTeacherId, toTeacherId, subjectId, classId, reason } = body as {
      fromTeacherId?: string
      toTeacherId?: string
      subjectId?: string
      classId?: string
      reason?: string
    }

    if (!fromTeacherId || !toTeacherId || !subjectId || !classId) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Поля fromTeacherId, toTeacherId, subjectId, classId обязательны',
      )
    }
    if (fromTeacherId === toTeacherId) {
      return errorResponse('VALIDATION_ERROR', 'Учитель-источник и получатель не должны совпадать')
    }

    const existing = await prisma.teacherSubject.findUnique({
      where: {
        teacherId_subjectId_classId: {
          teacherId: fromTeacherId,
          subjectId,
          classId,
        },
      },
    })
    if (!existing) {
      return errorResponse(
        'NOT_FOUND',
        'У исходного учителя нет такой нагрузки (предмет/класс не назначен)',
        404,
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Записываем сам факт передачи
      const transfer = await tx.teacherLoadTransfer.create({
        data: {
          fromTeacherId,
          toTeacherId,
          subjectId,
          classId,
          reason: reason || null,
          transferredBy: auth.session.user.id,
        },
      })

      // Получатель: если уже есть TeacherSubject — увеличиваем часы; иначе создаём
      const target = await tx.teacherSubject.findUnique({
        where: {
          teacherId_subjectId_classId: {
            teacherId: toTeacherId,
            subjectId,
            classId,
          },
        },
      })
      if (target) {
        await tx.teacherSubject.update({
          where: { id: target.id },
          data: { hoursPerWeek: target.hoursPerWeek + existing.hoursPerWeek },
        })
      } else {
        await tx.teacherSubject.create({
          data: {
            teacherId: toTeacherId,
            subjectId,
            classId,
            hoursPerWeek: existing.hoursPerWeek,
          },
        })
      }

      // Удаляем старую запись TeacherSubject у fromTeacher
      // (исторические оценки/scheduleEntries остаются нетронутыми — это ключевая идея ТЗ:
      //  они доступны новому учителю read-only через GET /transfer/history)
      await tx.teacherSubject.delete({ where: { id: existing.id } })

      return transfer
    })

    return successResponse(result, 201)
  } catch (error) {
    console.error('POST /api/v1/workload/transfer error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось передать нагрузку', 500)
  }
}

/**
 * GET /api/v1/workload/transfer?toTeacherId=X[&classId=Y][&subjectId=Z]
 *
 * Возвращает read-only историю передач, актуальных для указанного учителя:
 * для каждой передачи — список оценок/расписания/тем "до transferredAt".
 *
 * Используется на странице нового учителя, чтобы показать прошлые данные класса в read-only.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request)
    if (auth.response) return auth.response
    const { role, id: userId } = auth.session.user

    const { searchParams } = new URL(request.url)
    const toTeacherId = searchParams.get('toTeacherId')
    const classId = searchParams.get('classId')
    const subjectId = searchParams.get('subjectId')

    if (!toTeacherId) {
      return errorResponse('VALIDATION_ERROR', 'Параметр toTeacherId обязателен')
    }

    // RBAC: admins/secretary may inspect any teacher's transfer history; a teacher
    // (or curator) may only see transfers addressed to themselves. Anyone else is
    // denied — otherwise any authenticated user could read other teachers' historical grades.
    const ADMIN_VIEW: string[] = ['super_admin', 'analyst', 'zavuch', 'secretary']
    if (!ADMIN_VIEW.includes(role)) {
      if (role === 'teacher' || role === 'curator') {
        const self = await prisma.teacher.findFirst({ where: { userId }, select: { id: true } })
        if (!self || self.id !== toTeacherId) {
          return errorResponse('FORBIDDEN', 'Нет доступа к истории передачи нагрузки', 403)
        }
      } else {
        return errorResponse('FORBIDDEN', 'Нет доступа к истории передачи нагрузки', 403)
      }
    }

    const where: Record<string, unknown> = { toTeacherId }
    if (classId) where.classId = classId
    if (subjectId) where.subjectId = subjectId

    const transfers = await prisma.teacherLoadTransfer.findMany({
      where,
      orderBy: { transferredAt: 'desc' },
    })

    // Для каждой передачи — соберём связанные исторические записи (read-only)
    const enriched = await Promise.all(
      transfers.map(async (t) => {
        const [grades, scheduleEntries] = await Promise.all([
          prisma.grade.findMany({
            where: {
              teacherId: t.fromTeacherId,
              subjectId: t.subjectId,
              date: { lte: t.transferredAt },
              student: { classId: t.classId },
            },
            select: {
              id: true,
              studentId: true,
              value: true,
              scale: true,
              date: true,
              status: true,
              category: { select: { name: true, weight: true } },
            },
            orderBy: { date: 'asc' },
            take: 500,
          }),
          prisma.scheduleEntry.findMany({
            where: {
              teacherId: t.fromTeacherId,
              subjectId: t.subjectId,
              classId: t.classId,
              periodEnd: { lte: t.transferredAt },
            },
            select: {
              id: true,
              dayOfWeek: true,
              periodStart: true,
              periodEnd: true,
              slot: { select: { slotNumber: true, startTime: true, endTime: true } },
            },
            take: 500,
          }),
        ])
        return {
          transfer: t,
          readonlyGrades: grades,
          readonlySchedule: scheduleEntries,
        }
      }),
    )

    return successResponse(enriched)
  } catch (error) {
    console.error('GET /api/v1/workload/transfer error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить историю передачи', 500)
  }
}
