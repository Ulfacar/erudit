import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const DECISION_STATUSES = new Set(['approved', 'rejected', 'partial']);

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const isForward = body.action === 'forward';
    const status = typeof body.status === 'string' ? body.status : '';

    if (!isForward && !DECISION_STATUSES.has(status)) {
      return errorResponse('VALIDATION_ERROR', 'Некорректное действие');
    }

    const auth = await withAuth(request, {
      roles: isForward
        ? ['super_admin', 'accountant', 'chief_accountant']
        : ['super_admin', 'finance_manager'],
    });
    if (auth.response) return auth.response;

    const purchaseRequest = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!purchaseRequest) {
      return errorResponse('NOT_FOUND', 'Заявка не найдена', 404);
    }

    if (isForward) {
      if (purchaseRequest.status !== 'pending') {
        return errorResponse('VALIDATION_ERROR', 'Заявку нельзя переслать');
      }

      const updated = await prisma.purchaseRequest.update({
        where: { id },
        data: {
          status: 'forwarded',
          forwardedById: auth.session.user.id,
          forwardedRole: auth.session.user.role,
          forwardedAt: new Date(),
        },
      });

      return successResponse(updated);
    }

    if (purchaseRequest.status !== 'forwarded' && auth.session.user.role !== 'super_admin') {
      return errorResponse('VALIDATION_ERROR', 'Заявка ещё не передана финменеджеру');
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
        signedRole: auth.session.user.role,
        reviewedAt: new Date(),
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PATCH /api/v1/purchase-requests/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить заявку', 500);
  }
}
