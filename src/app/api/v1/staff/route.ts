import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Супер-администратор',
  analyst: 'Аналитик',
  zavuch: 'Завуч',
  secretary: 'Секретарь',
  teacher: 'Педагог',
  curator: 'Куратор',
  specialist: 'Специалист',
  student: 'Ученик',
  parent: 'Родитель',
};

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const roleFilter = searchParams.get('role');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (roleFilter) {
      where.role = roleFilter;
    }

    if (search) {
      where.OR = [
        { login: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { teacher: { firstName: { contains: search, mode: 'insensitive' } } },
        { teacher: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        login: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        teacher: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true,
            position: true,
            photo: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = users.map((u) => ({
      id: u.id,
      login: u.login,
      email: u.email,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role] || u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      firstName: u.teacher?.firstName || null,
      lastName: u.teacher?.lastName || null,
      middleName: u.teacher?.middleName || null,
      position: u.teacher?.position || null,
      photo: u.teacher?.photo || null,
    }));

    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/staff error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить список персонала', 500);
  }
}
