import { type NextRequest } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { successResponse, errorResponse } from '@/shared/lib/api-response'
import { withAuth } from '@/shared/lib/api-auth'

const MONTHLY_TRANSFER_LIMIT = 5

/**
 * PATCH /api/v1/groups/transfers/[id]
 * Approve or reject a pending group-transfer request.
 * Body: { action: 'approve' | 'reject', approvedBy?: string, reason?: string }
 *
 * On approval:
 *   - enforce 5-per-month-per-class hard limit (per ТЗ)
 *   - actually move the student between groups
 *   - create UrgentIssue for zavuch+director (notification per ТЗ)
 */
export async function PATCH(
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
    const { action, approvedBy, reason } = body as {
      action?: 'approve' | 'reject'
      approvedBy?: string
      reason?: string
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return errorResponse('VALIDATION_ERROR', 'action должен быть approve или reject')
    }

    const transfer = await prisma.groupTransfer.findUnique({ where: { id } })
    if (!transfer) {
      return errorResponse('NOT_FOUND', 'Запрос не найден', 404)
    }
    if (transfer.status !== 'pending') {
      return errorResponse(
        'CONFLICT',
        `Запрос уже обработан (статус: ${transfer.status})`,
        409,
      )
    }

    if (action === 'reject') {
      const updated = await prisma.groupTransfer.update({
        where: { id },
        data: {
          status: 'rejected',
          rejectReason: reason ?? null,
          decidedAt: new Date(),
        },
      })
      return successResponse(updated)
    }

    if (!approvedBy) {
      return errorResponse('VALIDATION_ERROR', 'Для одобрения необходимо указать approvedBy')
    }

    // Лимит 5 одобренных переводов в месяц на класс (по ТЗ)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const approvedThisMonth = await prisma.groupTransfer.count({
      where: {
        classId: transfer.classId,
        status: 'approved',
        decidedAt: { gte: startOfMonth, lt: endOfMonth },
      },
    })
    if (approvedThisMonth >= MONTHLY_TRANSFER_LIMIT) {
      return errorResponse(
        'LIMIT_REACHED',
        `Достигнут месячный лимит переводов между группами (${MONTHLY_TRANSFER_LIMIT}). Обратитесь к завучу.`,
        429,
      )
    }

    // Перемещение ученика между группами + смена статуса в одной транзакции
    const [student, classInfo] = await Promise.all([
      prisma.student.findUnique({
        where: { id: transfer.studentId },
        select: { firstName: true, lastName: true },
      }),
      prisma.class.findUnique({
        where: { id: transfer.classId },
        select: { grade: true, letter: true },
      }),
    ])

    const updated = await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: transfer.studentId },
        data: {
          groups: {
            disconnect: { id: transfer.fromGroupId },
            connect: { id: transfer.toGroupId },
          },
        },
      })
      return tx.groupTransfer.update({
        where: { id },
        data: {
          status: 'approved',
          approvedBy,
          decidedAt: new Date(),
        },
        include: {
          fromGroup: { select: { id: true, name: true } },
          toGroup: { select: { id: true, name: true } },
        },
      })
    })

    // Уведомление завучу/директору через UrgentIssue
    const studentName = student ? `${student.lastName} ${student.firstName}` : 'ученик'
    const classLabel = classInfo ? `${classInfo.grade}${classInfo.letter}` : ''
    await prisma.urgentIssue.create({
      data: {
        title: `Перевод между группами: ${studentName} (${classLabel})`,
        description: `Перевод одобрен. Из группы «${updated.fromGroup.name}» в «${updated.toGroup.name}». Утверждено в этом месяце: ${approvedThisMonth + 1}/${MONTHLY_TRANSFER_LIMIT}.`,
        priority: 'medium',
        status: 'open',
        visibleTo: ['zavuch', 'super_admin', 'analyst'],
        classId: transfer.classId,
        studentId: transfer.studentId,
        authorId: auth.session.user.id,
      },
    })

    return successResponse(updated)
  } catch (error) {
    console.error('PATCH /api/v1/groups/transfers/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось обработать запрос', 500)
  }
}
