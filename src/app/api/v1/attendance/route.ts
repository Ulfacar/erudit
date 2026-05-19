import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const date = searchParams.get('date');
    const studentId = searchParams.get('studentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = {};

    if (studentId) where.studentId = studentId;
    if (classId) where.student = { classId };

    if (date) {
      const d = new Date(date);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      where.date = { gte: dayStart, lt: dayEnd };
    } else if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    return successResponse(attendance);
  } catch (error) {
    console.error('GET /api/v1/attendance error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить посещаемость', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'secretary'],
    });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { studentId, date, status } = body;

    if (!studentId || !date || !status) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Поля studentId, date и status обязательны',
      );
    }

    const validStatuses = ['present', 'absent', 'late', 'excused', 'trip', 'quarantine'];
    if (!validStatuses.includes(status)) {
      return errorResponse(
        'VALIDATION_ERROR',
        `Статус должен быть одним из: ${validStatuses.join(', ')}`,
      );
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return errorResponse('NOT_FOUND', 'Ученик не найден', 404);
    }

    const record = await prisma.attendance.upsert({
      where: {
        studentId_date: {
          studentId,
          date: new Date(date),
        },
      },
      update: { status },
      create: {
        studentId,
        date: new Date(date),
        status,
      },
    });

    return successResponse(record, 201);
  } catch (error) {
    console.error('POST /api/v1/attendance error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить посещаемость', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await withAuth(request, {
      roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'secretary'],
    });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return errorResponse('VALIDATION_ERROR', 'Поля id и status обязательны');
    }

    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Запись не найдена', 404);
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: { status },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PUT /api/v1/attendance error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить посещаемость', 500);
  }
}
