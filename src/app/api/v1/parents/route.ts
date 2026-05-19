import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const parents = await prisma.parent.findMany({
      where,
      include: {
        children: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                class: {
                  select: {
                    grade: true,
                    letter: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return successResponse(parents);
  } catch (error) {
    console.error('GET /api/v1/parents error:', error);
    return errorResponse('INTERNAL_ERROR', 'Ошибка при получении списка родителей', 500);
  }
}
