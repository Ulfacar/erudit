import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * PATCH /api/v1/applications/[id] — согласование заявления (approve/reject)
 * завучем/учителем/админом.
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst'] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const { status, reviewNote } = await request.json();
    if (!['approved', 'rejected'].includes(status)) {
      return errorResponse('VALIDATION_ERROR', 'status должен быть approved или rejected');
    }
    const updated = await prisma.application.update({
      where: { id },
      data: { status, reviewNote: reviewNote ?? null, reviewedBy: auth.session.user.id },
    });
    return successResponse(updated);
  } catch (error) {
    console.error('PATCH /api/v1/applications/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить заявление', 500);
  }
}
