import { type NextRequest } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { successResponse, errorResponse } from '@/shared/lib/api-response'
import { withAuth } from '@/shared/lib/api-auth'

/**
 * Видимость дескрипторов педагога по ТЗ:
 *   accessLevel=1 — общий: super_admin, analyst, zavuch, сам педагог
 *   accessLevel=2 — только super_admin, analyst, zavuch
 *   accessLevel=3 — только super_admin, analyst (для нас)
 */
function maxLevelForRole(role: string, isSelf: boolean): number {
  if (role === 'super_admin' || role === 'analyst') return 3
  if (role === 'zavuch') return 2
  if (isSelf) return 1
  return 0 // нет доступа
}

/**
 * GET /api/v1/teachers/[id]/descriptors?year=2025
 * Возвращает дескрипторы, доступные текущему пользователю по уровню.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request)
    if (auth.response) return auth.response

    const { id } = await params
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!teacher) return errorResponse('NOT_FOUND', 'Педагог не найден', 404)

    const isSelf = teacher.userId === auth.session.user.id
    const maxLevel = maxLevelForRole(auth.session.user.role, isSelf)
    if (maxLevel === 0) {
      return errorResponse('FORBIDDEN', 'Нет доступа к дескрипторам', 403)
    }

    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const where: Record<string, unknown> = {
      teacherId: id,
      accessLevel: { lte: maxLevel },
    }
    if (yearParam) where.year = Number(yearParam)

    const descriptors = await prisma.teacherDescriptor.findMany({
      where,
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    })

    return successResponse(descriptors)
  } catch (error) {
    console.error('GET /api/v1/teachers/[id]/descriptors error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить дескрипторы', 500)
  }
}

/**
 * POST /api/v1/teachers/[id]/descriptors
 * Создание дескриптора. Доступно: super_admin, analyst, zavuch.
 * Уровень доступа дескриптора задаётся автором, но не выше его собственного.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch'],
    })
    if (auth.response) return auth.response

    const { id } = await params
    const body = await request.json()
    const { year, text, accessLevel } = body as {
      year?: number
      text?: string
      accessLevel?: number
    }

    if (!year || !text) {
      return errorResponse('VALIDATION_ERROR', 'Поля year и text обязательны')
    }
    if (text.length > 2000) {
      return errorResponse('VALIDATION_ERROR', 'Текст дескриптора не более 2000 символов')
    }

    const requestedLevel = Number(accessLevel ?? 1)
    if (![1, 2, 3].includes(requestedLevel)) {
      return errorResponse('VALIDATION_ERROR', 'accessLevel должен быть 1, 2 или 3')
    }
    const max = maxLevelForRole(auth.session.user.role, false)
    if (requestedLevel > max) {
      return errorResponse(
        'FORBIDDEN',
        `Ваша роль может создавать дескрипторы максимум уровня ${max}`,
        403,
      )
    }

    const teacher = await prisma.teacher.findUnique({ where: { id } })
    if (!teacher) return errorResponse('NOT_FOUND', 'Педагог не найден', 404)

    const created = await prisma.teacherDescriptor.create({
      data: {
        teacherId: id,
        year: Number(year),
        text,
        accessLevel: requestedLevel,
        authorId: auth.session.user.id,
      },
    })
    return successResponse(created, 201)
  } catch (error) {
    console.error('POST /api/v1/teachers/[id]/descriptors error:', error)
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать дескриптор', 500)
  }
}
