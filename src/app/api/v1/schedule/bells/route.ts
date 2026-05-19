import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const bells = await prisma.bellSchedule.findMany({
      orderBy: { slotNumber: 'asc' },
    });

    return successResponse(bells);
  } catch (error) {
    console.error('GET /api/v1/schedule/bells error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить расписание звонков', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { id, slotNumber, startTime, endTime, type } = body;

    if (!id) {
      return errorResponse('VALIDATION_ERROR', 'Поле id обязательно');
    }

    const existing = await prisma.bellSchedule.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Слот расписания звонков не найден', 404);
    }

    const updated = await prisma.bellSchedule.update({
      where: { id },
      data: {
        ...(slotNumber !== undefined && { slotNumber }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(type !== undefined && { type }),
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PUT /api/v1/schedule/bells error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить слот расписания звонков', 500);
  }
}
