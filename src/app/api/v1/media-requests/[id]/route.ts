import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { errorResponse, successResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import type { MaintenanceStatus, Role } from '@prisma/client';

const WRITE_ROLES: Role[] = ['super_admin', 'analyst', 'media'];
const STATUSES: MaintenanceStatus[] = ['open', 'in_progress', 'done', 'cancelled'];

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: WRITE_ROLES });
    if (auth.response) return auth.response;

    const { id } = await ctx.params;
    const body = await request.json();
    const data: {
      status?: MaintenanceStatus;
      assigneeId?: string | null;
      assigneeName?: string | null;
    } = {};

    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) {
        return errorResponse('VALIDATION_ERROR', 'Invalid status');
      }
      data.status = body.status;
    }
    if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId || null;
    if (body.assigneeName !== undefined) data.assigneeName = body.assigneeName || null;

    if (Object.keys(data).length === 0) {
      return errorResponse('VALIDATION_ERROR', 'No fields to update');
    }

    const updated = await prisma.mediaRequest.update({ where: { id }, data });
    return successResponse(updated);
  } catch (error) {
    console.error('PATCH mediaRequest error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить заявку', 500);
  }
}
