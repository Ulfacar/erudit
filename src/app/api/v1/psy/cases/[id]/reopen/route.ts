import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { emitEvent } from '@/shared/lib/agent/engine';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

const REOPEN_STAGES = ['diagnosis', 'ips'] as const;
type ReopenStage = (typeof REOPEN_STAGES)[number];

/** POST /api/v1/psy/cases/[id]/reopen — переоткрыть закрытый кейс и начать новый цикл ИПС. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const user = auth.session.user;

  const scope = getPsyScope(user.id, user.role);
  if (!(await canAccessCase(scope, id))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  const body = await request.json().catch(() => ({}));
  const stage: ReopenStage = REOPEN_STAGES.includes(body.stage as ReopenStage) ? body.stage : 'ips';

  try {
    const c = await prisma.psyCase.findUnique({ where: { id }, select: { status: true, stage: true } });
    if (!c) return errorResponse('NOT_FOUND', 'Кейс не найден', 404);
    if (c.status !== 'closed') {
      return errorResponse('VALIDATION_ERROR', 'Переоткрыть можно только закрытый кейс');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.psyCase.update({
        where: { id },
        data: {
          stage,
          status: 'in_progress',
          closedAt: null,
          outcome: 'in_progress',
        },
      });

      const latest = await tx.psyIps.findFirst({
        where: { caseId: id },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });

      const ips = await tx.psyIps.create({
        data: {
          caseId: id,
          version: (latest?.version ?? 0) + 1,
          parentIpsId: latest?.id ?? null,
          status: 'draft',
          createdBy: user.id,
        },
        select: { version: true },
      });

      return { caseId: updated.id, stage: updated.stage, ipsVersion: ips.version };
    });

    await emitEvent('case.reopened', { actorUserId: user.id, payload: { caseId: id, stage } });

    return successResponse(result);
  } catch (e) {
    console.error('POST psy/cases/[id]/reopen error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось переоткрыть кейс', 500);
  }
}
