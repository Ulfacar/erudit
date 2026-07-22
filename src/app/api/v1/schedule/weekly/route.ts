import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET all schedule entries for days 1-6 (Mon-Sat).
 * Used by the substitutions page weekly grid.
 * No filters — returns everything so the grid can show all classes.
 *
 * Роли = STAFF_TIER страницы /substitutions (единственного потребителя). Без этого
 * ученик/родитель вытягивали общешкольную сетку со всеми классами и педагогами,
 * хотя обычный GET /api/v1/schedule жёстко сужен до своего класса.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'],
    });
    if (auth.response) return auth.response;

    const entries = await prisma.scheduleEntry.findMany({
      where: { dayOfWeek: { in: [1, 2, 3, 4, 5, 6] } },
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
          select: { id: true, slotNumber: true, startTime: true, endTime: true, type: true },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { slot: { slotNumber: 'asc' } }],
    });

    return successResponse(entries);
  } catch (error) {
    console.error('GET /api/v1/schedule/weekly error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить расписание', 500);
  }
}
