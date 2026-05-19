import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET aggregate stats for the substitutions dashboard.
 * Returns: teacherSubjectCount, scheduleEntryCount, substitutionCount, teacherCount.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const [teacherSubjectCount, scheduleEntryCount, substitutionCount, teacherCount] =
      await Promise.all([
        prisma.teacherSubject.count(),
        prisma.scheduleEntry.count(),
        prisma.substitution.count(),
        prisma.teacher.count(),
      ]);

    return successResponse({
      teacherSubjectCount,
      scheduleEntryCount,
      substitutionCount,
      teacherCount,
    });
  } catch (error) {
    console.error('GET /api/v1/substitutions/stats error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить статистику', 500);
  }
}
