import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { withAuth } from '@/shared/lib/api-auth';
import { successResponse, errorResponse } from '@/shared/lib/api-response';

const WRITE = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'safeguarding_lead', 'event_manager'] as const;

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...WRITE] });
  if (auth.response) return auth.response;

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const data: { report?: string | null; completedAt?: Date | null } = {};

  if ('report' in body) {
    data.report = body.report === null || body.report === undefined ? null : String(body.report);
  }
  if ('completedAt' in body) {
    if (body.completedAt) {
      const completedAt = new Date(String(body.completedAt));
      if (Number.isNaN(completedAt.getTime())) {
        return errorResponse('VALIDATION_ERROR', 'Некорректная дата');
      }
      data.completedAt = completedAt;
    } else {
      data.completedAt = null;
    }
  }
  if (Object.keys(data).length === 0) {
    return errorResponse('VALIDATION_ERROR', 'Нет полей для обновления');
  }

  try {
    const event = await prisma.schoolEvent.update({ where: { id }, data });
    return successResponse(event);
  } catch (e) {
    console.error('PATCH event error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить мероприятие', 500);
  }
}
