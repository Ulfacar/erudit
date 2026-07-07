import { NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { gradeBandGrades } from '@/shared/lib/psy-screening';

/** GET /api/v1/psy/screening/campaigns/mine - active screening campaigns for current student. */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: ['student'] as Role[] });
  if (auth.response) return auth.response;

  try {
    const st = await prisma.student.findUnique({
      where: { userId: auth.session.user.id },
      select: { id: true, branchId: true, class: { select: { grade: true } } },
    });
    if (!st) return errorResponse('FORBIDDEN', 'Student not found', 403);

    const studentGrade = st.class?.grade;
    if (studentGrade == null) return successResponse([]);

    const campaigns = await prisma.psyScreeningCampaign.findMany({
      where: { status: 'active' },
      orderBy: { openedAt: 'desc' },
    });

    const matchedCampaigns = campaigns.filter((campaign) => {
      const grades = campaign.grade != null ? [campaign.grade] : gradeBandGrades(campaign.gradeBand);
      return grades.includes(studentGrade) && (campaign.branchId == null || campaign.branchId === st.branchId);
    });

    const campaignIds = matchedCampaigns.map((campaign) => campaign.id);
    if (campaignIds.length === 0) return successResponse([]);

    const templateIds = [...new Set(matchedCampaigns.map((campaign) => campaign.templateId))];

    const [templates, results] = await Promise.all([
      prisma.psyDiagnosticTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, name: true, schema: true },
      }),
      prisma.psyScreeningResult.findMany({
        where: { studentId: st.id, campaignId: { in: campaignIds } },
        select: { campaignId: true },
      }),
    ]);

    const templatesById = new Map(templates.map((template) => [template.id, template]));
    const doneCampaignIds = new Set(results.map((result) => result.campaignId));

    const payload = matchedCampaigns
      .map((campaign) => {
        const template = templatesById.get(campaign.templateId);
        if (!template) return null;
        return {
          id: campaign.id,
          title: campaign.title,
          gradeBand: campaign.gradeBand,
          grade: campaign.grade,
          done: doneCampaignIds.has(campaign.id),
          template,
        };
      })
      .filter((campaign): campaign is NonNullable<typeof campaign> => campaign != null);

    return successResponse(payload);
  } catch (e) {
    console.error('GET psy/screening/campaigns/mine error:', e);
    return errorResponse('INTERNAL_ERROR', 'Failed to load screening campaigns', 500);
  }
}
