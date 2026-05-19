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
    const role = auth.session.user.role
    const userId = auth.session.user.id

    const { id } = await params

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        parentLinks: { select: { parentId: true } },
        user: { select: { id: true } },
      },
    })
    if (!student) {
      return errorResponse('NOT_FOUND', 'Ученик не найден', 404)
    }
    if (role === 'student' && student.user?.id !== userId) {
      return errorResponse('FORBIDDEN', 'Доступ запрещён', 403)
    }
    if (role === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { userId },
        select: { id: true },
      })
      const ok = parent ? student.parentLinks.some((pl) => pl.parentId === parent.id) : false
      if (!ok) return errorResponse('FORBIDDEN', 'Доступ запрещён', 403)
    }

    const incidents = await prisma.behaviorIncident.findMany({
      where: { studentId: id },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(incidents)
  } catch (error) {
    console.error('GET /api/v1/students/[id]/incidents error:', error)
    return errorResponse('INTERNAL_ERROR', 'Ошибка при получении инцидентов', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch', 'teacher', 'curator'],
    })
    if (auth.response) return auth.response

    const { id } = await params
    const body = await request.json()

    const student = await prisma.student.findUnique({ where: { id } })
    if (!student) {
      return errorResponse('NOT_FOUND', 'Ученик не найден', 404)
    }

    if (!body.type || !body.description) {
      return errorResponse('BAD_REQUEST', 'Необходимо указать тип и описание инцидента', 400)
    }

    const incident = await prisma.behaviorIncident.create({
      data: {
        studentId: id,
        reporterId: auth.session.user.id,
        type: body.type,
        description: body.description,
      },
    })

    return successResponse(incident, 201)
  } catch (error) {
    console.error('POST /api/v1/students/[id]/incidents error:', error)
    return errorResponse('INTERNAL_ERROR', 'Ошибка при создании инцидента', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    })
    if (auth.response) return auth.response

    const { id: _studentId } = await params
    const body = await request.json()

    if (!body.incidentId || !body.status) {
      return errorResponse('BAD_REQUEST', 'Необходимо указать incidentId и status', 400)
    }

    const validStatuses = ['pending', 'moderated', 'resolved']
    if (!validStatuses.includes(body.status)) {
      return errorResponse('BAD_REQUEST', 'Недопустимый статус', 400)
    }

    const incident = await prisma.behaviorIncident.findUnique({
      where: { id: body.incidentId },
    })

    if (!incident) {
      return errorResponse('NOT_FOUND', 'Инцидент не найден', 404)
    }

    const updated = await prisma.behaviorIncident.update({
      where: { id: body.incidentId },
      data: {
        status: body.status,
        moderatedBy: auth.session.user.id,
        moderatedAt: new Date(),
        parentNotified: body.parentNotified ?? incident.parentNotified,
      },
    })

    return successResponse(updated)
  } catch (error) {
    console.error('PATCH /api/v1/students/[id]/incidents error:', error)
    return errorResponse('INTERNAL_ERROR', 'Ошибка при обновлении инцидента', 500)
  }
}
