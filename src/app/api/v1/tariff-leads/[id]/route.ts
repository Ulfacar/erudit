import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const ALLOWED = new Set(['new', 'in_progress', 'won', 'lost']);
const ROLES = ['super_admin', 'founder', 'analyst'] as const;

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const status = typeof body.status === 'string' ? body.status : '';

    if (!ALLOWED.has(status)) {
      return errorResponse('VALIDATION_ERROR', 'Некорректный статус');
    }

    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;

    const decisionNote =
      typeof body.decisionNote === 'string' && body.decisionNote.trim()
        ? body.decisionNote.trim()
        : null;

    const updated = await prisma.tariffLead.update({
      where: { id },
      data: {
        status,
        decisionNote,
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PATCH /api/v1/tariff-leads/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить заявку', 500);
  }
}
