import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

function normalizePlannedMeetings(value: unknown) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 5;
}

/** GET /api/v1/psy/cases/[id]/interventions — список интервенций кейса. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, id))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  try {
    const items = await prisma.psyIntervention.findMany({
      where: { caseId: id },
      orderBy: { startedAt: 'desc' },
      include: { _count: { select: { sessions: true } } },
    });
    return successResponse(items);
  } catch (e) {
    console.error('GET psy/cases/[id]/interventions error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить интервенции', 500);
  }
}

/** POST /api/v1/psy/cases/[id]/interventions — создать интервенцию. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, id))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  const body = await request.json().catch(() => ({}));
  const ipsId = typeof body.ipsId === 'string' ? body.ipsId : '';

  try {
    const ips = await prisma.psyIps.findFirst({ where: { id: ipsId, caseId: id, status: 'approved' } });
    if (!ips) return errorResponse('VALIDATION_ERROR', 'Нужен утверждённый ИПС');

    const active = await prisma.psyIntervention.findFirst({ where: { caseId: id, status: 'active' }, select: { id: true } });
    if (active) return errorResponse('VALIDATION_ERROR', 'По кейсу уже есть активная интервенция');

    const created = await prisma.$transaction(async (tx) => {
      const intervention = await tx.psyIntervention.create({
        data: {
          caseId: id,
          ipsId,
          plannedMeetings: normalizePlannedMeetings(body.plannedMeetings),
          status: 'active',
        },
      });

      await tx.psyCase.update({ where: { id }, data: { stage: 'intervention' } });
      return intervention;
    });

    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/cases/[id]/interventions error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать интервенцию', 500);
  }
}
