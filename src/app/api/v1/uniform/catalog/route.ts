import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const ROLES = ['parent', 'student', 'uniform_manager', 'super_admin'] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;

    const items = await prisma.uniformItem.findMany({
      where: { variants: { some: { available: { gt: 0 } } } },
      select: {
        id: true,
        name: true,
        category: true,
        basic: true,
        price: true,
        variants: {
          where: { available: { gt: 0 } },
          select: { id: true, size: true, available: true },
          orderBy: { size: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return successResponse(items);
  } catch (error) {
    console.error('GET /api/v1/uniform/catalog error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить каталог формы', 500);
  }
}
