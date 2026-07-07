import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/admission/[id]/psych-conclusion
 * Приёмная видит ПОЛНОЕ заключение психолога — но ТОЛЬКО intake-кейса (первичная
 * диагностика при поступлении). Ответ Эмира #2: «Приёмной показываем полное
 * заключение», при этом обычные психологические беседы (терапия) остаются личными.
 * Поэтому отдаём кейс только при isIntake=true; riskJustification (закрытый контур
 * safeguarding) не раскрываем.
 */
const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const lead = await prisma.admissionLead.findUnique({ where: { id }, select: { psychCaseId: true } });
  if (!lead?.psychCaseId) return errorResponse('NOT_FOUND', 'Заключение психолога не найдено', 404);

  try {
    const psyCase = await prisma.psyCase.findUnique({
      where: { id: lead.psychCaseId },
      select: {
        isIntake: true, riskLevel: true, status: true, summary: true, intakeVerdict: true,
        sessions: {
          where: { type: 'primary_diagnosis' },
          orderBy: { date: 'asc' },
          select: { dapAssessment: true, qualNote: true, date: true },
        },
      },
    });
    // Гард: приёмной отдаём только первичную диагностику, не терапию.
    if (!psyCase || !psyCase.isIntake) return errorResponse('NOT_FOUND', 'Заключение психолога не найдено', 404);

    const assessment = psyCase.sessions.map((s) => s.dapAssessment).filter(Boolean).join('\n\n');
    const observation = psyCase.sessions.map((s) => s.qualNote).filter(Boolean).join('\n');
    const hasConclusion = Boolean((psyCase.summary && psyCase.summary.trim()) || assessment);

    return successResponse({
      riskLevel: psyCase.riskLevel,
      status: psyCase.status,
      summary: psyCase.summary ?? '',
      verdict: psyCase.intakeVerdict ?? null,
      assessment,
      observation,
      hasConclusion,
    });
  } catch (e) {
    console.error('GET psych-conclusion error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить заключение', 500);
  }
}
