import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/* Role metadata in Russian */
const ROLE_META: Record<string, { label: string; description: string }> = {
  super_admin: { label: 'Супер-администратор', description: 'Полный доступ ко всем модулям системы' },
  analyst: { label: 'Аналитик', description: 'Доступ к отчетам и аналитике' },
  zavuch: { label: 'Завуч', description: 'Управление учебным процессом, расписанием и нагрузкой' },
  secretary: { label: 'Секретарь', description: 'Делопроизводство, документы и реестры' },
  teacher: { label: 'Педагог', description: 'Ведение журнала, оценок и домашних заданий' },
  curator: { label: 'Куратор', description: 'Управление классом, связь с родителями' },
  specialist: { label: 'Специалист', description: 'Логопед, психолог, медработник' },
  student: { label: 'Ученик', description: 'Просмотр расписания, оценок и домашних заданий' },
  parent: { label: 'Родитель', description: 'Просмотр информации о ребёнке' },
};

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    // Get user counts grouped by role
    const roleCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    const roleCountMap = new Map(roleCounts.map((r) => [r.role, r._count.id]));

    const roles = Object.entries(ROLE_META).map(([key, meta]) => ({
      role: key,
      label: meta.label,
      description: meta.description,
      userCount: roleCountMap.get(key as never) || 0,
    }));

    return successResponse(roles);
  } catch (error) {
    console.error('GET /api/v1/roles error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить роли', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin'] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { login, password, role } = body;

    if (!login || !password || !role) {
      return errorResponse('VALIDATION_ERROR', 'Поля login, password и role обязательны');
    }

    const validRoles = Object.keys(ROLE_META);
    if (!validRoles.includes(role)) {
      return errorResponse('VALIDATION_ERROR', `Недопустимая роль: ${role}`);
    }

    const existing = await prisma.user.findUnique({ where: { login } });
    if (existing) {
      return errorResponse('CONFLICT', 'Пользователь с таким логином уже существует', 409);
    }

    // In production, hash the password. For now, store as-is for demo.
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        login,
        password: hashedPassword,
        role: role as never,
      },
      select: {
        id: true,
        login: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return successResponse(user, 201);
  } catch (error) {
    console.error('POST /api/v1/roles error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать пользователя', 500);
  }
}
