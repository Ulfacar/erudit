import { type NextRequest } from 'next/server';
import type { Role, SupervisionStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope } from '@/shared/lib/branch-scope';
import { countSessionsDone } from '@/modules/zvr/supervision';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];
const SUPERVISION_STATUSES = ['improved', 'no_change', 'needs_council'] as const satisfies readonly SupervisionStatus[];

async function guardBranch(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...ZVR_ROLES] });
  if (auth.response) return { response: auth.response };

  const { id } = await ctx.params;
  const supervisionCase = await prisma.supervisionCase.findUnique({
    where: { id },
    select: {
      id: true,
      student: { select: { branchId: true } },
    },
  });
  if (!supervisionCase) return { response: errorResponse('NOT_FOUND', 'Кейс сопровождения не найден', 404) };

  if (auth.session.user.role !== 'super_admin') {
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId);
    if (scope.closed || !scope.branchId || scope.branchId !== supervisionCase.student.branchId) {
      return { response: errorResponse('FORBIDDEN', 'Forbidden', 403) };
    }
  }

  return { auth, supervisionCase };
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardBranch(request, ctx);
    if (guard.response) return guard.response;

    const body = await request.json().catch(() => ({}));
    const data: { status?: SupervisionStatus; sessionsPlanned?: number } = {};

    if (body.status !== undefined) {
      if (!SUPERVISION_STATUSES.includes(body.status)) {
        return errorResponse('BAD_REQUEST', 'Недопустимый статус сопровождения', 400);
      }
      data.status = body.status;
    }

    if (body.sessionsPlanned !== undefined) {
      if (!Number.isInteger(body.sessionsPlanned) || body.sessionsPlanned < 1 || body.sessionsPlanned > 20) {
        return errorResponse('BAD_REQUEST', 'sessionsPlanned должен быть от 1 до 20', 400);
      }
      data.sessionsPlanned = body.sessionsPlanned;
    }

    if (Object.keys(data).length === 0) {
      return errorResponse('BAD_REQUEST', 'Нет данных для обновления', 400);
    }

    const updated = await prisma.supervisionCase.update({
      where: { id: guard.supervisionCase.id },
      data,
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
        incident: {
          select: {
            id: true,
            type: true,
            level: true,
            status: true,
          },
        },
      },
    });

    return successResponse({
      ...updated,
      sessionsDone: await countSessionsDone(prisma, updated.studentId, updated.openedAt),
    });
  } catch (error) {
    console.error('PATCH /api/v1/zvr/supervision/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить кейс сопровождения', 500);
  }
}
