import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { name, type, startDate, endDate, isActive } = body;

    const existing = await prisma.academicPeriod.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Учебный период не найден', 404);
    }

    if (type) {
      const validTypes = ['trimester', 'holiday', 'quarantine'];
      if (!validTypes.includes(type)) {
        return errorResponse('VALIDATION_ERROR', `Тип периода должен быть: ${validTypes.join(', ')}`);
      }
    }

    if (startDate || endDate) {
      const start = new Date(startDate ?? existing.startDate);
      const end = new Date(endDate ?? existing.endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return errorResponse('VALIDATION_ERROR', 'Некорректный формат даты');
      }

      if (start >= end) {
        return errorResponse('VALIDATION_ERROR', 'Дата начала должна быть раньше даты окончания');
      }
    }

    // If activating this period, deactivate all others
    if (isActive === true && !existing.isActive) {
      await prisma.academicPeriod.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const updated = await prisma.academicPeriod.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PUT /api/v1/periods/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить учебный период', 500);
  }
}
