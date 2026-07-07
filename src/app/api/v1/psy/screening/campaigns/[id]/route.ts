import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { CASE_OWNER_ROLES, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';
import { gradeBandGrades } from '@/shared/lib/psy-screening';

type CampaignCoverageInput = {
  id: string;
  gradeBand: string;
  grade: number | null;
  branchId: string | null;
};

async function campaignCoverage(campaign: CampaignCoverageInput) {
  const grades = gradeBandGrades(campaign.gradeBand);
  const studentWhere = {
    class: { grade: campaign.grade ?? { in: grades } },
    ...(campaign.branchId ? { branchId: campaign.branchId } : {}),
  };

  const [target, done, riskCount] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.psyScreeningResult.count({ where: { campaignId: campaign.id } }),
    prisma.psyScreeningResult.count({ where: { campaignId: campaign.id, isRisk: true } }),
  ]);

  return {
    target,
    done,
    riskCount,
    coveragePct: target > 0 ? Math.round((done / target) * 100) : 0,
  };
}

/** GET /api/v1/psy/screening/campaigns/[id] - campaign details and risk group. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  try {
    const campaign = await prisma.psyScreeningCampaign.findUnique({ where: { id } });
    if (!campaign) return errorResponse('NOT_FOUND', 'Campaign not found', 404);

    const riskResults = await prisma.psyScreeningResult.findMany({
      where: { campaignId: id, isRisk: true },
      orderBy: { completedAt: 'desc' },
      include: {
        student: {
          select: {
            psyCode: true,
            firstName: true,
            lastName: true,
            class: { select: { grade: true, letter: true } },
          },
        },
      },
    });

    const results = riskResults.map((result) => ({
      ...result,
      student: {
        psyCode: result.student.psyCode,
        firstName: result.student.firstName,
        lastName: result.student.lastName,
        className: `${result.student.class.grade}${result.student.class.letter}`,
      },
    }));

    return successResponse({
      ...campaign,
      ...(await campaignCoverage(campaign)),
      results,
    });
  } catch (e) {
    console.error('GET psy/screening/campaigns/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Failed to load screening campaign', 500);
  }
}

/** PATCH /api/v1/psy/screening/campaigns/[id] - close campaign. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => ({}));
  if (body.status !== 'closed') {
    return errorResponse('VALIDATION_ERROR', 'Only campaign closing is supported');
  }

  try {
    const updated = await prisma.psyScreeningCampaign.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date() },
    });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH psy/screening/campaigns/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Failed to close screening campaign', 500);
  }
}
