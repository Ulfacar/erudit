import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const levels = await prisma.schoolLevel.findMany({
      include: {
        _count: {
          select: { classes: true },
        },
      },
      orderBy: { fromGrade: 'asc' },
    });

    const data = levels.map((level) => ({
      id: level.id,
      name: level.name,
      fromGrade: level.fromGrade,
      toGrade: level.toGrade,
      classCount: level._count.classes,
    }));

    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/school-levels error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить уровни обучения', 500);
  }
}
