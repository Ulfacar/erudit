import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const DECISION_STATUSES = new Set(['approved', 'rejected', 'partial']);

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'finance_manager'] });
    if (auth.response) return auth.response;

    const { id } = await ctx.params;
    const body = await request.json();
    const status = typeof body.status === 'string' ? body.status : '';

    if (!DECISION_STATUSES.has(status)) {
      return errorResponse('VALIDATION_ERROR', 'Некорректный статус решения');
    }

    const decisionNote =
      typeof body.decisionNote === 'string' && body.decisionNote.trim()
        ? body.decisionNote.trim()
        : null;

    const updated = await prisma.purchaseRequest.update({
      where: { id },
      data: {
        status,
        decisionNote,
        reviewedById: auth.session.user.id,
        reviewedAt: new Date(),
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PATCH /api/v1/purchase-requests/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить заявку', 500);
  }
}
