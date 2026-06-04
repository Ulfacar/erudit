import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/** GET /api/v1/admission/stats — счётчики воронки + конверсия. */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'zavuch', 'secretary'] });
    if (auth.response) return auth.response;

    const byStage = await prisma.admissionLead.groupBy({ by: ['stage'], _count: true });
    const counts = Object.fromEntries(byStage.map((s) => [s.stage, s._count]));
    const total = byStage.reduce((s, x) => s + x._count, 0);
    const enrolled = (counts.enrolled as number | undefined) ?? 0;

    return successResponse({
      counts,
      total,
      conversion: total ? Math.round((enrolled / total) * 100) : 0,
    });
  } catch (error) {
    console.error('GET /api/v1/admission/stats error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить статистику', 500);
  }
}
