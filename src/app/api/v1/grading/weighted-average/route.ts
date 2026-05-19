import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { getWeightedAveragesForClass } from '@/modules/grading/services/weighted-average';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');
    const periodId = searchParams.get('periodId');

    if (!classId || !subjectId || !periodId) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Параметры classId, subjectId и periodId обязательны',
      );
    }

    const averages = await getWeightedAveragesForClass(classId, subjectId, periodId);

    return successResponse(averages);
  } catch (error) {
    console.error('GET /api/v1/grading/weighted-average error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось рассчитать средневзвешенные', 500);
  }
}
