import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const VIEW_ROLES = ['psy_coordinator', 'senior_psychologist', 'super_admin'] as const;

/**
 * GET /api/v1/psy/ai-feedback/summary — сводка качества ИИ для координатора ПС.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...VIEW_ROLES] });
  if (auth.response) return auth.response;

  try {
    const [aggregate, grouped] = await Promise.all([
      prisma.psyAiFeedback.aggregate({
        _avg: { rating: true },
        _count: true,
      }),
      prisma.psyAiFeedback.groupBy({
        by: ['createdBy'],
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    const userIds = grouped.map((item) => item.createdBy);
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, login: true },
        })
      : [];
    const loginById = new Map(users.map((user) => [user.id, user.login]));

    return successResponse({
      avg: aggregate._avg.rating ?? null,
      count: aggregate._count,
      byPsychologist: grouped.map((item) => ({
        userId: item.createdBy,
        login: loginById.get(item.createdBy) ?? null,
        avg: item._avg.rating ?? null,
        count: item._count,
      })),
    });
  } catch (e) {
    console.error('GET psy/ai-feedback/summary error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить сводку качества ИИ', 500);
  }
}
