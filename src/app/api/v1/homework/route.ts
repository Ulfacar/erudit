import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/homework
 * List homework assignments, filterable by classId and subjectId.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');

    const where: Record<string, unknown> = {};
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;

    const homework = await prisma.homework.findMany({
      where,
      include: {
        class: {
          select: { id: true, grade: true, letter: true },
        },
        subject: {
          select: { id: true, name: true },
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { dueDate: 'desc' },
    });

    return successResponse(homework);
  } catch (error) {
    console.error('GET /api/v1/homework error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить домашние задания', 500);
  }
}

/**
 * POST /api/v1/homework
 * Create a homework assignment. Teachers only for their classes.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['teacher', 'curator', 'zavuch', 'super_admin'],
    });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { classId, subjectId, teacherId, description, dueDate } = body;

    if (!classId || !subjectId || !teacherId || !description || !dueDate) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Все поля обязательны: classId, subjectId, teacherId, description, dueDate',
      );
    }

    // Verify class exists
    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) {
      return errorResponse('NOT_FOUND', 'Класс не найден', 404);
    }

    const homework = await prisma.homework.create({
      data: {
        classId,
        subjectId,
        teacherId,
        description,
        dueDate: new Date(dueDate),
      },
      include: {
        class: {
          select: { id: true, grade: true, letter: true },
        },
        subject: {
          select: { id: true, name: true },
        },
        teacher: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return successResponse(homework, 201);
  } catch (error) {
    console.error('POST /api/v1/homework error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать домашнее задание', 500);
  }
}
