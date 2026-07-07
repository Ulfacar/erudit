import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';
import { notifyUser } from '@/shared/lib/agent/notify';

const OUTCOMES = ['improved', 'referred', 'continue'];
const TARGETS = ['psychiatrist', 'speech', 'medical', 'other'];

/** POST /api/v1/psy/interventions/[id]/complete — завершить интервенцию. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);

  const body = await request.json().catch(() => ({}));
  const outcome = typeof body.outcome === 'string' ? body.outcome : '';
  if (!OUTCOMES.includes(outcome)) {
    return errorResponse('VALIDATION_ERROR', 'outcome: improved | referred | continue');
  }

  try {
    const intervention = await prisma.psyIntervention.findUnique({ where: { id }, include: { case: true } });
    if (!intervention) return errorResponse('NOT_FOUND', 'Интервенция не найдена', 404);
    if (!(await canAccessCase(scope, intervention.caseId))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

    const updated = await prisma.$transaction(async (tx) => {
      const completed = await tx.psyIntervention.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date() },
      });

      const caseData: Record<string, unknown> = {
        summary: body.summary ?? intervention.case.summary,
        stage: 'review',
      };

      if (outcome === 'referred') {
        caseData.status = 'paused';
        await tx.psyReferral.create({
          data: {
            caseId: intervention.caseId,
            target: TARGETS.includes(body.referralTarget) ? body.referralTarget : 'other',
            note: body.referralNote || null,
            createdBy: auth.session.user.id,
          },
        });
      }

      await tx.psyCase.update({ where: { id: intervention.caseId }, data: caseData });
      return completed;
    });

    if (outcome === 'referred') {
      const seniors = await prisma.user.findMany({ where: { role: 'senior_psychologist', isActive: true }, select: { id: true } });
      await Promise.all(seniors.map((s) => notifyUser(s.id, '🧠 Психологическая служба', 'Кейс: направление к специалисту')));
    }

    return successResponse(updated);
  } catch (e) {
    console.error('POST psy/interventions/[id]/complete error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось завершить интервенцию', 500);
  }
}
