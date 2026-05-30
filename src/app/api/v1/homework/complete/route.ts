import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * POST /api/v1/homework/complete  { homeworkId, studentId?, done }
 * Ученик/родитель отмечает ДЗ как «выполнено» (EduPage).
 * Ученик — за себя; родитель — за своего ребёнка (studentId обязателен и проверяется).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['student', 'parent'] });
    if (auth.response) return auth.response;

    const role = auth.session.user.role;
    const userId = auth.session.user.id;
    const body = await request.json();
    const { homeworkId, done } = body;
    let { studentId } = body;
    if (!homeworkId) return errorResponse('VALIDATION_ERROR', 'homeworkId обязателен');

    if (role === 'student') {
      const self = await prisma.student.findFirst({ where: { userId }, select: { id: true } });
      if (!self) return errorResponse('FORBIDDEN', 'Профиль ученика не найден', 403);
      studentId = self.id;
    } else {
      if (!studentId) return errorResponse('VALIDATION_ERROR', 'studentId обязателен для родителя');
      const link = await prisma.parentStudent.findFirst({
        where: { studentId, parent: { userId } }, select: { studentId: true },
      });
      if (!link) return errorResponse('FORBIDDEN', 'Это не ваш ребёнок', 403);
    }

    if (done === false) {
      await prisma.homeworkCompletion.deleteMany({ where: { homeworkId, studentId } });
      return successResponse({ homeworkId, studentId, done: false });
    }

    const rec = await prisma.homeworkCompletion.upsert({
      where: { homeworkId_studentId: { homeworkId, studentId } },
      update: {},
      create: { homeworkId, studentId },
    });
    return successResponse({ ...rec, done: true });
  } catch (error) {
    console.error('POST /api/v1/homework/complete error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось отметить ДЗ', 500);
  }
}
