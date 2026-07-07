import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { CASE_OWNER_ROLES, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';
import { GRADE_BANDS, gradeBandGrades } from '@/shared/lib/psy-screening';

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
    coveragePct: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0,
  };
}

/** GET /api/v1/psy/screening/campaigns - list screening campaigns. */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  try {
    const campaigns = await prisma.psyScreeningCampaign.findMany({
      orderBy: { openedAt: 'desc' },
    });
    const payload = await Promise.all(
      campaigns.map(async (campaign) => ({
        ...campaign,
        ...(await campaignCoverage(campaign)),
      })),
    );
    return successResponse(payload);
  } catch (e) {
    console.error('GET psy/screening/campaigns error:', e);
    return errorResponse('INTERNAL_ERROR', 'Failed to load screening campaigns', 500);
  }
}

/** POST /api/v1/psy/screening/campaigns - create a screening campaign. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { title, gradeBand, grade, templateId, riskThreshold, branchId } = body as Record<string, unknown>;

  if (!String(title ?? '').trim()) {
    return errorResponse('VALIDATION_ERROR', 'Campaign title is required');
  }
  if (typeof gradeBand !== 'string' || !GRADE_BANDS.includes(gradeBand)) {
    return errorResponse('VALIDATION_ERROR', 'Invalid grade band');
  }
  if (typeof templateId !== 'string' || !templateId.trim()) {
    return errorResponse('VALIDATION_ERROR', 'Template is required');
  }

  try {
    const template = await prisma.psyDiagnosticTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    });
    if (!template) return errorResponse('VALIDATION_ERROR', 'Template not found');

    const created = await prisma.psyScreeningCampaign.create({
      data: {
        title: String(title).trim(),
        gradeBand,
        grade: typeof grade === 'number' ? grade : null,
        templateId: template.id,
        createdBy: auth.session.user.id,
        branchId: typeof branchId === 'string' && branchId.trim() ? branchId.trim() : null,
        status: 'active',
        riskThreshold: typeof riskThreshold === 'number' ? riskThreshold : null,
      },
    });
    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/screening/campaigns error:', e);
    return errorResponse('INTERNAL_ERROR', 'Failed to create screening campaign', 500);
  }
}
