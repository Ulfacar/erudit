import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, branchWhere } from '@/shared/lib/branch-scope';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);

    const classes = await prisma.class.findMany({
      where: branchWhere(scope),
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
        _count: {
          select: { students: true },
        },
      },
      orderBy: [{ grade: 'asc' }, { letter: 'asc' }],
    });

    const data = classes.map((c) => ({
      id: c.id,
      grade: c.grade,
      letter: c.letter,
      levelId: c.levelId,
      level: c.level,
      branchId: c.branchId,
      capacity: c.capacity,
      curatorId: c.curatorId,
      curator: c.curator,
      studentCount: c._count.students,
    }));

    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/classes error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить классы', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'zavuch'] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { grade, letter, levelId, curatorId, capacity } = body;

    if (!grade || !letter || !levelId) {
      return errorResponse('VALIDATION_ERROR', 'Поля grade, letter и levelId обязательны');
    }

    const level = await prisma.schoolLevel.findUnique({ where: { id: levelId } });
    if (!level) {
      return errorResponse('NOT_FOUND', 'Уровень обучения не найден', 404);
    }

    if (grade < level.fromGrade || grade > level.toGrade) {
      return errorResponse(
        'VALIDATION_ERROR',
        `Класс ${grade} не соответствует уровню "${level.name}" (${level.fromGrade}-${level.toGrade})`,
      );
    }

    const existing = await prisma.class.findFirst({
      where: { grade, letter },
    });
    if (existing) {
      return errorResponse('CONFLICT', `Класс ${grade}${letter} уже существует`, 409);
    }

    const newClass = await prisma.class.create({
      data: {
        grade,
        letter: letter.toUpperCase(),
        levelId,
        curatorId: curatorId || null,
        capacity: capacity == null || capacity === '' ? null : Number(capacity),
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

    return successResponse(newClass, 201);
  } catch (error) {
    console.error('POST /api/v1/classes error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать класс', 500);
  }
}
