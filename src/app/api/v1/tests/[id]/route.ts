import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/tests/[id]
 * Ученик — получает вопросы БЕЗ правильных ответов (+ свой результат, если проходил).
 * Учитель/админ — полный тест + список попыток (результаты класса).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;
    const { id } = await ctx.params;

    const test = await prisma.test.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!test) return errorResponse('NOT_FOUND', 'Тест не найден', 404);

    if (role === 'student') {
      const self = await prisma.student.findFirst({ where: { userId }, select: { id: true } });
      if (!self) return errorResponse('FORBIDDEN', 'Нет доступа', 403);
      const attempt = await prisma.testAttempt.findUnique({
        where: { testId_studentId: { testId: id, studentId: self.id } },
        include: { answers: true },
      });
      return successResponse({
        id: test.id, title: test.title, description: test.description,
        questions: test.questions.map((q) => ({ id: q.id, order: q.order, text: q.text, type: q.type, options: q.options, points: q.points })),
        myAttempt: attempt
          ? { score: attempt.score, maxScore: attempt.maxScore, answers: attempt.answers.map((a) => ({ questionId: a.questionId, answer: a.answer, isCorrect: a.isCorrect, pointsAwarded: a.pointsAwarded })) }
          : null,
      });
    }

    // staff — полный тест + попытки
    const attempts = await prisma.testAttempt.findMany({ where: { testId: id }, orderBy: { submittedAt: 'desc' } });
    const ids = [...new Set(attempts.map((a) => a.studentId))];
    const students = await prisma.student.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
    const sm = new Map(students.map((s) => [s.id, `${s.lastName} ${s.firstName}`]));
    return successResponse({
      ...test,
      attemptList: attempts.map((a) => ({ studentId: a.studentId, studentName: sm.get(a.studentId) ?? '—', score: a.score, maxScore: a.maxScore, submittedAt: a.submittedAt })),
    });
  } catch (error) {
    console.error('GET /api/v1/tests/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить тест', 500);
  }
}
