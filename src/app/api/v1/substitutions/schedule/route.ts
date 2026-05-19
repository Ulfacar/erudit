import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET schedule entries for a given day of week.
 * Used by the substitutions page to show the weekly grid.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = request.nextUrl;
    const day = searchParams.get('day');

    if (!day) {
      return errorResponse('VALIDATION_ERROR', 'Параметр day обязателен');
    }

    const dayOfWeek = Number(day);

    const entries = await prisma.scheduleEntry.findMany({
      where: { dayOfWeek },
      include: {
        class: {
          include: { level: true },
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true, middleName: true, position: true, photo: true },
        },
        subject: {
          select: { id: true, name: true, color: true },
        },
        slot: {
          select: { id: true, slotNumber: true, startTime: true, endTime: true },
        },
      },
      orderBy: [{ slot: { slotNumber: 'asc' } }],
    });

    return successResponse(entries);
  } catch (error) {
    console.error('GET /api/v1/substitutions/schedule error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить расписание', 500);
  }
}
