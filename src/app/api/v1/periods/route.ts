import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const periods = await prisma.academicPeriod.findMany({
      include: {
        _count: {
          select: { grades: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    const data = periods.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      startDate: p.startDate,
      endDate: p.endDate,
      isActive: p.isActive,
      gradeCount: p._count.grades,
    }));

    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/periods error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить учебные периоды', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { name, type, startDate, endDate, isActive } = body;

    if (!name || !type || !startDate || !endDate) {
      return errorResponse('VALIDATION_ERROR', 'Поля name, type, startDate и endDate обязательны');
    }

    const validTypes = ['trimester', 'holiday', 'quarantine'];
    if (!validTypes.includes(type)) {
      return errorResponse('VALIDATION_ERROR', `Тип периода должен быть: ${validTypes.join(', ')}`);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return errorResponse('VALIDATION_ERROR', 'Некорректный формат даты');
    }

    if (start >= end) {
      return errorResponse('VALIDATION_ERROR', 'Дата начала должна быть раньше даты окончания');
    }

    // If setting as active, deactivate all others
    if (isActive) {
      await prisma.academicPeriod.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const period = await prisma.academicPeriod.create({
      data: {
        name,
        type,
        startDate: start,
        endDate: end,
        isActive: isActive ?? false,
      },
    });

    return successResponse(period, 201);
  } catch (error) {
    console.error('POST /api/v1/periods error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать учебный период', 500);
  }
}
