import { NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const DECIDE_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch'];
const DECISION_STATUSES = new Set(['approved', 'rejected']);

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: DECIDE_ROLES });
    if (auth.response) return auth.response;

    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const status = typeof body.status === 'string' ? body.status : '';

    if (!DECISION_STATUSES.has(status)) {
      return errorResponse('VALIDATION_ERROR', 'Некорректный статус решения');
    }

    const substituteTeacherId =
      body.substituteTeacherId === null || body.substituteTeacherId === undefined
        ? null
        : String(body.substituteTeacherId);

    const updated = await prisma.timeOffRequest.update({
      where: { id },
      data: {
        status,
        substituteTeacherId: substituteTeacherId || null,
        reviewedById: auth.session.user.id,
        signedRole: auth.session.user.role,
        reviewedAt: new Date(),
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PATCH /api/v1/time-off/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить заявку на отгул', 500);
  }
}
