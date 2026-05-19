import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { id } = await params;

    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        level: true,
        curator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            status: true,
          },
          orderBy: { lastName: 'asc' },
        },
        groups: {
          include: {
            _count: { select: { students: true } },
          },
        },
        _count: {
          select: { students: true },
        },
      },
    });

    if (!cls) {
      return errorResponse('NOT_FOUND', 'Класс не найден', 404);
    }

    return successResponse({
      ...cls,
      studentCount: cls._count.students,
    });
  } catch (error) {
    console.error('GET /api/v1/classes/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить класс', 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch', 'secretary'],
    });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { grade, letter, levelId, curatorId } = body;

    const existing = await prisma.class.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Класс не найден', 404);
    }

    if (levelId) {
      const level = await prisma.schoolLevel.findUnique({ where: { id: levelId } });
      if (!level) {
        return errorResponse('NOT_FOUND', 'Уровень обучения не найден', 404);
      }
      const targetGrade = grade ?? existing.grade;
      if (targetGrade < level.fromGrade || targetGrade > level.toGrade) {
        return errorResponse(
          'VALIDATION_ERROR',
          `Класс ${targetGrade} не соответствует уровню "${level.name}" (${level.fromGrade}-${level.toGrade})`,
        );
      }
    }

    if ((grade !== undefined || letter !== undefined) && (grade !== existing.grade || letter !== existing.letter)) {
      const duplicate = await prisma.class.findFirst({
        where: {
          grade: grade ?? existing.grade,
          letter: letter ?? existing.letter,
          id: { not: id },
        },
      });
      if (duplicate) {
        return errorResponse('CONFLICT', `Класс ${grade ?? existing.grade}${letter ?? existing.letter} уже существует`, 409);
      }
    }

    const updated = await prisma.class.update({
      where: { id },
      data: {
        ...(grade !== undefined && { grade }),
        ...(letter !== undefined && { letter: letter.toUpperCase() }),
        ...(levelId !== undefined && { levelId }),
        ...(curatorId !== undefined && { curatorId: curatorId || null }),
      },
      include: {
        level: true,
        curator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PUT /api/v1/classes/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить класс', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const { id } = await params;

    const existing = await prisma.class.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });

    if (!existing) {
      return errorResponse('NOT_FOUND', 'Класс не найден', 404);
    }

    if (existing._count.students > 0) {
      return errorResponse(
        'CONFLICT',
        `Невозможно удалить класс с учениками (${existing._count.students} чел.)`,
        409,
      );
    }

    await prisma.class.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/v1/classes/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить класс', 500);
  }
}
