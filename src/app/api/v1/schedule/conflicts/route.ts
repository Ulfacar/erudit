import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { checkConflicts } from '@/modules/schedule/services/conflict-checker';
import { withAuth } from '@/shared/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { teacherId, dayOfWeek, slotId, periodStart, periodEnd, excludeEntryId } = body;

    if (!teacherId || dayOfWeek === undefined || !slotId || !periodStart || !periodEnd) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Все поля обязательны: teacherId, dayOfWeek, slotId, periodStart, periodEnd',
      );
    }

    const conflicts = await checkConflicts(
      teacherId,
      Number(dayOfWeek),
      slotId,
      new Date(periodStart),
      new Date(periodEnd),
      excludeEntryId,
    );

    return successResponse({
      hasConflict: conflicts.length > 0,
      conflicts,
    });
  } catch (error) {
    console.error('POST /api/v1/schedule/conflicts error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось проверить конфликты', 500);
  }
}
