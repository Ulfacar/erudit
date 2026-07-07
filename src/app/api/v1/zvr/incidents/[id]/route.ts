import { type NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope } from '@/shared/lib/branch-scope';
import { hasIncompleteSupervisionCycle, monitoringDeadline } from '@/modules/zvr/supervision';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];
const INCIDENT_STATUSES = ['pending', 'moderated', 'resolved'] as const;

async function guardBranch(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...ZVR_ROLES] });
  if (auth.response) return { response: auth.response };

  const { id } = await ctx.params;
  const incident = await prisma.behaviorIncident.findUnique({
    where: { id },
    select: {
      id: true,
      level: true,
      student: { select: { branchId: true } },
    },
  });
  if (!incident) return { response: errorResponse('NOT_FOUND', 'Инцидент не найден', 404) };
  if (auth.session.user.role !== 'super_admin') {
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId);
    if (scope.closed || !scope.branchId || scope.branchId !== incident.student.branchId) {
      return { response: errorResponse('FORBIDDEN', 'Forbidden', 403) };
    }
  }

  return { auth, incident };
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardBranch(request, ctx);
    if (guard.response) return guard.response;

    const body = await request.json().catch(() => ({}));
    if (!INCIDENT_STATUSES.includes(body.status)) {
      return errorResponse('BAD_REQUEST', 'Недопустимый статус', 400);
    }

    if (body.status === 'resolved' && guard.incident.level === 'high') {
      const blocked = await hasIncompleteSupervisionCycle(prisma, guard.incident.id);
      if (blocked) {
        return errorResponse('CONFLICT', 'Нельзя закрыть: не пройден цикл бесед (мин. по каждому вовлечённому)', 409);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const next = await tx.behaviorIncident.update({
        where: { id: guard.incident.id },
        data: {
          status: body.status,
          moderatedBy: guard.auth.session.user.id,
          moderatedAt: now,
        },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              class: { select: { grade: true, letter: true } },
            },
          },
          participants: {
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  middleName: true,
                  class: { select: { grade: true, letter: true } },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (body.status === 'resolved') {
        await tx.supervisionCase.updateMany({
          where: {
            behaviorIncidentId: guard.incident.id,
            closedAt: null,
          },
          data: { monitoringUntil: monitoringDeadline(now) },
        });
      }

      return next;
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PATCH /api/v1/zvr/incidents/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить инцидент', 500);
  }
}
