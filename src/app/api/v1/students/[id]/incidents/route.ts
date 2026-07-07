import { type NextRequest } from 'next/server'
import type { Role } from '@prisma/client'
import { prisma } from '@/shared/lib/prisma'
import { successResponse, errorResponse } from '@/shared/lib/api-response'
import { withAuth } from '@/shared/lib/api-auth'
import { canAccessStudent } from '@/shared/lib/student-access'
import { getBranchScope } from '@/shared/lib/branch-scope'
import { hasIncompleteSupervisionCycle, monitoringDeadline } from '@/modules/zvr/supervision'

const VALID_LEVELS = ['low', 'medium', 'high'] as const
const VALID_PARTICIPANT_ROLES = ['initiator', 'victim', 'accomplice', 'witness'] as const
const VALID_STATUSES = ['pending', 'moderated', 'resolved'] as const
const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[]

type BehaviorLevelValue = (typeof VALID_LEVELS)[number]
type IncidentRoleValue = (typeof VALID_PARTICIPANT_ROLES)[number]

function isBehaviorLevel(value: unknown): value is BehaviorLevelValue {
  return typeof value === 'string' && VALID_LEVELS.includes(value as BehaviorLevelValue)
}

function isIncidentRole(value: unknown): value is IncidentRoleValue {
  return typeof value === 'string' && VALID_PARTICIPANT_ROLES.includes(value as IncidentRoleValue)
}

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
      roles: ['super_admin', 'zavuch', 'teacher', 'curator', 'safeguarding_lead'],
    })
    if (auth.response) return auth.response

    const { id } = await params
    const body = await request.json()

    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    })
    if (!student) {
      return errorResponse('NOT_FOUND', 'Ученик не найден', 404)
    }

    if (!body.type || !body.description) {
      return errorResponse('BAD_REQUEST', 'Необходимо указать тип и описание инцидента', 400)
    }

    const canAccessMainStudent = await canAccessStudent(auth.session.user.role, auth.session.user.id, id)
    if (!canAccessMainStudent) {
      return errorResponse('FORBIDDEN', 'Доступ запрещён', 403)
    }

    const level = body.level === undefined ? 'low' : body.level
    if (!isBehaviorLevel(level)) {
      return errorResponse('BAD_REQUEST', 'Недопустимый уровень инцидента', 400)
    }

    if (body.participants !== undefined && !Array.isArray(body.participants)) {
      return errorResponse('BAD_REQUEST', 'participants должен быть массивом', 400)
    }

    const participantsInput = Array.isArray(body.participants) ? body.participants : []
    const participants = new Map<string, IncidentRoleValue>()
    for (const participant of participantsInput) {
      if (!participant || typeof participant.studentId !== 'string' || !isIncidentRole(participant.role)) {
        return errorResponse('BAD_REQUEST', 'Неверный формат участника инцидента', 400)
      }
      if (participant.studentId === id || participants.has(participant.studentId)) {
        return errorResponse('BAD_REQUEST', 'Ученик не может быть в списке участников дважды', 400)
      }
      participants.set(participant.studentId, participant.role)
    }

    if (participants.size > 0) {
      const participantIds = [...participants.keys()]
      const accessible = await Promise.all(
        participantIds.map((studentId) => canAccessStudent(auth.session.user.role, auth.session.user.id, studentId)),
      )
      if (accessible.some((ok) => !ok)) {
        return errorResponse('FORBIDDEN', 'Доступ к участнику запрещён', 403)
      }

      const participantStudents = await prisma.student.findMany({
        where: { id: { in: participantIds } },
        select: { id: true, branchId: true },
      })
      if (participantStudents.length !== participantIds.length) {
        return errorResponse('BAD_REQUEST', 'Один из участников не найден', 400)
      }
      if (participantStudents.some((participantStudent) => participantStudent.branchId !== student.branchId)) {
        return errorResponse('FORBIDDEN', 'Участник другого филиала', 403)
      }
    }

    const incident = await prisma.$transaction(async (tx) => {
      const created = await tx.behaviorIncident.create({
        data: {
          studentId: id,
          reporterId: auth.session.user.id,
          type: body.type,
          description: body.description,
          level,
        },
      })

      if (participants.size > 0) {
        await tx.incidentParticipant.createMany({
          data: [...participants.entries()].map(([studentId, role]) => ({
            behaviorIncidentId: created.id,
            studentId,
            role,
          })),
        })
      }

      if (level === 'high') {
        const now = new Date()
        const studentIds = [id, ...participants.keys()]
        const rawReason = typeof body.type === 'string'
          ? body.type
          : typeof body.description === 'string'
            ? body.description
            : 'Инцидент'
        const reason = rawReason.trim().slice(0, 300)

        await tx.supervisionCase.createMany({
          data: studentIds.map((studentId) => ({
            studentId,
            behaviorIncidentId: created.id,
            reason,
            openedAt: now,
          })),
        })
      }

      return tx.behaviorIncident.findUnique({
        where: { id: created.id },
        include: { participants: true },
      })
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
      roles: [...ZVR_ROLES],
    })
    if (auth.response) return auth.response

    const { id: _studentId } = await params
    const body = await request.json()

    if (!body.incidentId || !body.status) {
      return errorResponse('BAD_REQUEST', 'Необходимо указать incidentId и status', 400)
    }

    if (!VALID_STATUSES.includes(body.status)) {
      return errorResponse('BAD_REQUEST', 'Недопустимый статус', 400)
    }

    const incident = await prisma.behaviorIncident.findUnique({
      where: { id: body.incidentId },
      select: {
        id: true,
        level: true,
        parentNotified: true,
        student: { select: { branchId: true } },
      },
    })

    if (!incident) {
      return errorResponse('NOT_FOUND', 'Инцидент не найден', 404)
    }

    if (auth.session.user.role !== 'super_admin') {
      const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId)
      if (scope.closed || !scope.branchId || scope.branchId !== incident.student.branchId) {
        return errorResponse('FORBIDDEN', 'Forbidden', 403)
      }
    }

    if (body.status === 'resolved' && incident.level === 'high') {
      const blocked = await hasIncompleteSupervisionCycle(prisma, incident.id)
      if (blocked) {
        return errorResponse('CONFLICT', 'Нельзя закрыть: не пройден цикл бесед (мин. по каждому вовлечённому)', 409)
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date()
      const next = await tx.behaviorIncident.update({
        where: { id: body.incidentId },
        data: {
          status: body.status,
          moderatedBy: auth.session.user.id,
          moderatedAt: now,
          parentNotified: body.parentNotified ?? incident.parentNotified,
        },
      })

      if (body.status === 'resolved') {
        await tx.supervisionCase.updateMany({
          where: {
            behaviorIncidentId: incident.id,
            closedAt: null,
          },
          data: { monitoringUntil: monitoringDeadline(now) },
        })
      }

      return next
    })

    return successResponse(updated)
  } catch (error) {
    console.error('PATCH /api/v1/students/[id]/incidents error:', error)
    return errorResponse('INTERNAL_ERROR', 'Ошибка при обновлении инцидента', 500)
  }
}
