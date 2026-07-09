import { type NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope } from '@/shared/lib/branch-scope';
import { getKpiConfig, saveKpiConfig } from '@/modules/olympiad/kpi-config';

const READ_ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;
const WRITE_ROLES = ['olympiad_coach', 'super_admin', 'zavuch'] as const;

function parseWeights(body: Record<string, unknown>) {
  const w1 = Number(body.w1);
  const w2 = Number(body.w2);
  const w3 = Number(body.w3);
  if (![w1, w2, w3].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) return null;
  if (Math.abs(w1 + w2 + w3 - 1) > 0.001) return null;
  return { w1, w2, w3 };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...READ_ROLES] });
    if (auth.response) return auth.response;

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    if (scope.closed) return errorResponse('FORBIDDEN', 'Forbidden', 403);

    return successResponse(await getKpiConfig(scope.branchId));
  } catch (error) {
    console.error('GET /api/v1/olympiad-center/kpi-config error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to load KPI config', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    if (scope.closed) return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const body = await request.json();
    const weights = parseWeights(body);
    if (!weights) return errorResponse('VALIDATION_ERROR', 'Invalid KPI weights');

    return successResponse(await saveKpiConfig(scope.branchId, weights, auth.session.user.id));
  } catch (error) {
    console.error('PUT /api/v1/olympiad-center/kpi-config error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to save KPI config', 500);
  }
}
