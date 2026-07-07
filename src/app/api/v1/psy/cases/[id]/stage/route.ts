import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

const STAGES = ['assessment', 'diagnosis', 'ips', 'intervention', 'review', 'closed'] as const;

/** PATCH /api/v1/psy/cases/[id]/stage — сменить этап кейса. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, id))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  const body = await request.json().catch(() => ({}));
  const stage = body.stage;
  if (typeof stage !== 'string' || !STAGES.includes(stage as (typeof STAGES)[number])) {
    return errorResponse('VALIDATION_ERROR', 'stage: assessment | diagnosis | ips | intervention | review | closed');
  }

  try {
    const c = await prisma.psyCase.findUnique({ where: { id }, select: { stage: true } });
    if (!c) return errorResponse('NOT_FOUND', 'Кейс не найден', 404);

    const currentIndex = STAGES.indexOf(c.stage);
    const nextIndex = STAGES.indexOf(stage as (typeof STAGES)[number]);
    const isAllowedTransition = nextIndex === currentIndex + 1 || nextIndex < currentIndex;
    if (!isAllowedTransition) {
      return errorResponse('VALIDATION_ERROR', 'Разрешён переход только на следующий этап или назад');
    }

    if (stage === 'intervention') {
      const approvedIpsCount = await prisma.psyIps.count({ where: { caseId: id, status: 'approved' } });
      if (approvedIpsCount === 0) {
        return errorResponse('VALIDATION_ERROR', 'Нельзя начать интервенцию без утверждённого ИПС');
      }
    }

    const data: Record<string, unknown> = { stage };
    if (stage === 'closed') {
      data.status = 'closed';
      data.closedAt = new Date();
    } else if (c.stage === 'closed') {
      data.status = 'in_progress';
      data.closedAt = null;
    }

    const updated = await prisma.psyCase.update({ where: { id }, data });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH psy/cases/[id]/stage error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сменить этап кейса', 500);
  }
}
