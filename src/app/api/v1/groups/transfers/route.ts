import { type NextRequest } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { successResponse, errorResponse } from '@/shared/lib/api-response'
import { withAuth } from '@/shared/lib/api-auth'

const MONTHLY_TRANSFER_LIMIT = 5

/**
 * GET /api/v1/groups/transfers
 * List transfers (filterable by classId, status, month)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request)
    if (auth.response) return auth.response

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null
    const month = searchParams.get('month') // YYYY-MM

    const where: Record<string, unknown> = {}
    if (classId) where.classId = classId
    if (status) where.status = status
    if (month) {
      const [yearStr, monthStr] = month.split('-')
      const year = Number(yearStr)
      const m = Number(monthStr) - 1
      if (!Number.isNaN(year) && !Number.isNaN(m)) {
        const start = new Date(year, m, 1)
        const end = new Date(year, m + 1, 1)
        where.createdAt = { gte: start, lt: end }
      }
    }

    const transfers = await prisma.groupTransfer.findMany({
      where,
      include: {
        fromGroup: { select: { id: true, name: true } },
        toGroup: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Также вернём счётчик утверждённых переводов в этом месяце
    let approvedThisMonth: number | null = null
    if (classId) {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      approvedThisMonth = await prisma.groupTransfer.count({
        where: {
          classId,
          status: 'approved',
          decidedAt: { gte: startOfMonth, lt: endOfMonth },
        },
      })
    }

    return successResponse({
      transfers,
      approvedThisMonth,
      monthlyLimit: MONTHLY_TRANSFER_LIMIT,
    })
  } catch (error) {
    console.error('GET /api/v1/groups/transfers error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить переводы', 500)
  }
}

/**
 * POST /api/v1/groups/transfers
 * Teacher requests a transfer of a student between two groups in the same class.
 * Body: { studentId, classId, fromGroupId, toGroupId, requestedBy }
 * Returns the created request (status='pending'). Must be approved by the
 * other group's teacher via PATCH.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['teacher', 'curator', 'super_admin', 'zavuch'],
    })
    if (auth.response) return auth.response

    const body = await request.json()
    const { studentId, classId, fromGroupId, toGroupId, requestedBy } = body as {
      studentId?: string
      classId?: string
      fromGroupId?: string
      toGroupId?: string
      requestedBy?: string
    }

    if (!studentId || !classId || !fromGroupId || !toGroupId || !requestedBy) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Поля studentId, classId, fromGroupId, toGroupId, requestedBy обязательны',
      )
    }
    if (fromGroupId === toGroupId) {
      return errorResponse('VALIDATION_ERROR', 'Группы должны различаться')
    }

    const [fromGroup, toGroup, student] = await Promise.all([
      prisma.classGroup.findUnique({ where: { id: fromGroupId } }),
      prisma.classGroup.findUnique({ where: { id: toGroupId } }),
      prisma.student.findUnique({ where: { id: studentId } }),
    ])

    if (!fromGroup || !toGroup) {
      return errorResponse('NOT_FOUND', 'Группа не найдена', 404)
    }
    if (fromGroup.classId !== classId || toGroup.classId !== classId) {
      return errorResponse('VALIDATION_ERROR', 'Группы должны быть из указанного класса')
    }
    if (!student || student.classId !== classId) {
      return errorResponse('VALIDATION_ERROR', 'Ученик не принадлежит указанному классу')
    }

    const existingPending = await prisma.groupTransfer.findFirst({
      where: { studentId, status: 'pending' },
    })
    if (existingPending) {
      return errorResponse(
        'CONFLICT',
        'У ученика уже есть незакрытый запрос на перевод',
        409,
      )
    }

    const transfer = await prisma.groupTransfer.create({
      data: {
        studentId,
        classId,
        fromGroupId,
        toGroupId,
        requestedBy,
        status: 'pending',
      },
    })

    return successResponse(transfer, 201)
  } catch (error) {
    console.error('POST /api/v1/groups/transfers error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать запрос на перевод', 500)
  }
}
