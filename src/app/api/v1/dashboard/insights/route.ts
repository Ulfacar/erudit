import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { computeInsights } from '@/shared/lib/ai/insights';

/** GET /api/v1/dashboard/insights — AI-инсайты ядра (аномалии по реальным данным). */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'zavuch', 'secretary'] });
    if (auth.response) return auth.response;

    const insights = await computeInsights({ includeFinance: auth.session.user.role !== 'secretary' });
    return successResponse(insights);
  } catch (error) {
    console.error('GET /api/v1/dashboard/insights error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось вычислить инсайты', 500);
  }
}
