import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * POST /api/v1/grading/sign  { gradeId }
 * Родитель/ученик «подписывает» оценку — подтверждает, что видел (EduPage).
 * Проверяем, что оценка принадлежит самому ученику или ребёнку родителя.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['student', 'parent'] });
    if (auth.response) return auth.response;

    const role = auth.session.user.role;
    const userId = auth.session.user.id;
    const { gradeId } = await request.json();
    if (!gradeId) return errorResponse('VALIDATION_ERROR', 'gradeId обязателен');

    const grade = await prisma.grade.findUnique({ where: { id: gradeId }, select: { id: true, studentId: true } });
    if (!grade) return errorResponse('NOT_FOUND', 'Оценка не найдена', 404);

    // Проверка прав на эту оценку
    if (role === 'student') {
      const self = await prisma.student.findFirst({ where: { userId }, select: { id: true } });
      if (!self || self.id !== grade.studentId) return errorResponse('FORBIDDEN', 'Это не ваша оценка', 403);
    } else {
      const link = await prisma.parentStudent.findFirst({
        where: { studentId: grade.studentId, parent: { userId } }, select: { studentId: true },
      });
      if (!link) return errorResponse('FORBIDDEN', 'Это оценка не вашего ребёнка', 403);
    }

    const updated = await prisma.grade.update({
      where: { id: gradeId },
      data: { parentSignedAt: new Date(), parentSignedBy: userId },
      select: { id: true, parentSignedAt: true },
    });
    return successResponse(updated);
  } catch (error) {
    console.error('POST /api/v1/grading/sign error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось подписать оценку', 500);
  }
}
