import { NextRequest } from 'next/server';
import { Prisma, type Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { computeScreeningScore, gradeBandGrades } from '@/shared/lib/psy-screening';

/** POST /api/v1/psy/screening/campaigns/[id]/submit - student submits screening result. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: ['student'] as Role[] });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  try {
    const st = await prisma.student.findUnique({
      where: { userId: auth.session.user.id },
      select: { id: true },
    });
    if (!st) return errorResponse('FORBIDDEN', 'Student not found', 403);

    const campaign = await prisma.psyScreeningCampaign.findFirst({
      where: { id, status: 'active' },
      select: { id: true, gradeBand: true, grade: true, riskThreshold: true, templateId: true },
    });
    if (!campaign) return errorResponse('NOT_FOUND', 'Active campaign not found', 404);

    const student = await prisma.student.findUnique({
      where: { id: st.id },
      select: { class: { select: { grade: true } } },
    });
    const studentGrade = student?.class?.grade;
    const grades = campaign.grade != null ? [campaign.grade] : gradeBandGrades(campaign.gradeBand);
    if (!studentGrade || !grades.includes(studentGrade)) {
      return errorResponse('VALIDATION_ERROR', 'Эта кампания не для вашей параллели');
    }

    const body = await request.json().catch(() => ({}));
    const { rawScores } = body as Record<string, unknown>;
    const tpl = await prisma.psyDiagnosticTemplate.findUnique({
      where: { id: campaign.templateId },
      select: { scaleConfig: true, schema: true },
    });
    const { score: computed, invalid } = computeScreeningScore(rawScores, tpl?.scaleConfig ?? null, tpl?.schema ?? null);
    if (invalid) return errorResponse('VALIDATION_ERROR', 'Некорректные ответы скрининга');
    const rawScoresData = rawScores == null ? undefined : (rawScores as Prisma.InputJsonValue);
    const isRisk =
      campaign.riskThreshold != null &&
      computed != null &&
      computed >= campaign.riskThreshold;

    const existing = await prisma.psyScreeningResult.findUnique({
      where: { campaignId_studentId: { campaignId: id, studentId: st.id } },
      select: { id: true },
    });

    await prisma.psyScreeningResult.upsert({
      where: { campaignId_studentId: { campaignId: id, studentId: st.id } },
      create: {
        campaignId: id,
        studentId: st.id,
        rawScores: rawScoresData,
        score: computed,
        isRisk,
      },
      update: {
        rawScores: rawScoresData,
        score: computed,
        isRisk,
        completedAt: new Date(),
      },
    });

    return successResponse({ ok: true }, existing ? 200 : 201);
  } catch (e) {
    console.error('POST psy/screening/campaigns/[id]/submit error:', e);
    return errorResponse('INTERNAL_ERROR', 'Failed to save screening result', 500);
  }
}
