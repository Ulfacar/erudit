import { type NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope } from '@/shared/lib/branch-scope';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];

async function guardBranch(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...ZVR_ROLES] });
  if (auth.response) return { response: auth.response };

  const { id } = await ctx.params;
  const obligation = await prisma.mediationObligation.findUnique({
    where: { id },
    select: {
      id: true,
      protocol: {
        select: {
          id: true,
          student: { select: { branchId: true } },
        },
      },
    },
  });
  if (!obligation) return { response: errorResponse('NOT_FOUND', 'Обязательство не найдено', 404) };

  if (auth.session.user.role !== 'super_admin') {
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId);
    if (scope.closed || !scope.branchId || scope.branchId !== obligation.protocol.student.branchId) {
      return { response: errorResponse('FORBIDDEN', 'Forbidden', 403) };
    }
  }

  return { auth, obligation };
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardBranch(request, ctx);
    if (guard.response) return guard.response;

    const body = await request.json().catch(() => ({}));
    if (typeof body.done !== 'boolean') {
      return errorResponse('VALIDATION_ERROR', 'done должен быть boolean', 400);
    }

    const updated = await prisma.mediationObligation.update({
      where: { id: guard.obligation.id },
      data: {
        done: body.done,
        doneAt: body.done ? new Date() : null,
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PATCH /api/v1/zvr/mediation/obligations/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить обязательство', 500);
  }
}
