import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { roleMatches } from '@/shared/lib/role-access';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const categories = await prisma.gradeCategory.findMany({
      orderBy: { order: 'asc' },
    });

    return successResponse(categories);
  } catch (error) {
    console.error('GET /api/v1/grading/categories error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить категории оценок', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { id, weight, isAssessment, requiresModeration, enabledForTeachers } = body as {
      id?: string;
      weight?: number;
      isAssessment?: boolean;
      requiresModeration?: boolean;
      enabledForTeachers?: boolean;
    };

    if (!id) {
      return errorResponse('VALIDATION_ERROR', 'Поле id обязательно');
    }

    if (weight !== undefined && (weight < 1 || weight > 5)) {
      return errorResponse('VALIDATION_ERROR', 'Удельный вес должен быть от 1 до 5');
    }

    const existing = await prisma.gradeCategory.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Категория не найдена', 404);
    }

    const data: Record<string, unknown> = {};
    if (weight !== undefined) data.weight = weight;
    if (isAssessment !== undefined) data.isAssessment = isAssessment;
    if (requiresModeration !== undefined) data.requiresModeration = requiresModeration;
    if (enabledForTeachers !== undefined) data.enabledForTeachers = enabledForTeachers;

    const updated = await prisma.gradeCategory.update({
      where: { id },
      data,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PUT /api/v1/grading/categories error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить категорию', 500);
  }
}

/**
 * POST /api/v1/grading/categories
 * Создание категории.
 *  - Админ/завуч/super_admin — без ограничений.
 *  - Учитель/куратор — только если в системе хотя бы одна категория имеет
 *    enabledForTeachers=true (по ТЗ: «разрешение на использование может дать
 *    только администратор системы»).
 *  Создаваемая учителем категория сохраняется с enabledForTeachers=false и
 *  requiresModeration=false по умолчанию.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch', 'teacher', 'curator', 'analyst'],
    });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { name, weight, isAssessment, requiresModeration } = body as {
      name?: string;
      weight?: number;
      isAssessment?: boolean;
      requiresModeration?: boolean;
    };

    if (!name || !weight) {
      return errorResponse('VALIDATION_ERROR', 'Поля name и weight обязательны');
    }
    if (weight < 1 || weight > 5) {
      return errorResponse('VALIDATION_ERROR', 'Удельный вес должен быть от 1 до 5');
    }

    const role = auth.session.user.role;
    const isAdminish = roleMatches(['super_admin', 'zavuch', 'analyst'], role);

    if (!isAdminish) {
      // Учителю — только если админ глобально разрешил создавать собственные категории.
      const teacherEnabled = await prisma.gradeCategory.count({
        where: { enabledForTeachers: true },
      });
      if (teacherEnabled === 0) {
        return errorResponse(
          'FORBIDDEN',
          'Создание собственных категорий оценок отключено. Обратитесь к администратору.',
          403,
        );
      }
    }

    // Поставим order в конец списка
    const max = await prisma.gradeCategory.aggregate({ _max: { order: true } });
    const nextOrder = (max._max.order ?? 0) + 1;

    const created = await prisma.gradeCategory.create({
      data: {
        name,
        weight,
        order: nextOrder,
        isAssessment: isAssessment ?? false,
        // На модерацию учитель не может ставить — только админ редактирует флаг через PUT
        requiresModeration: isAdminish ? (requiresModeration ?? false) : false,
        enabledForTeachers: false,
      },
    });

    return successResponse(created, 201);
  } catch (error) {
    console.error('POST /api/v1/grading/categories error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать категорию', 500);
  }
}
