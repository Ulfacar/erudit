import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * POST /api/v1/tests/[id]/submit  { answers: { [questionId]: string[] } }
 * Ученик сдаёт тест → авто-проверка закрытых типов (single/multiple/number).
 * Открытые (text) — 0 баллов (на проверку учителя). Одна попытка (пересдача перезаписывает).
 */
function eqSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].map(String).sort();
  const sb = [...b].map(String).sort();
  return sa.every((v, i) => v === sb[i]);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: ['student'] });
    if (auth.response) return auth.response;
    const userId = auth.session.user.id;
    const { id } = await ctx.params;

    const self = await prisma.student.findFirst({ where: { userId }, select: { id: true } });
    if (!self) return errorResponse('FORBIDDEN', 'Профиль ученика не найден', 403);

    const test = await prisma.test.findUnique({ where: { id }, include: { questions: true } });
    if (!test) return errorResponse('NOT_FOUND', 'Тест не найден', 404);
    if (test.status !== 'published') return errorResponse('FORBIDDEN', 'Тест недоступен', 403);

    const body = await request.json();
    const answers: Record<string, string[]> = body.answers ?? {};

    let score = 0;
    let maxScore = 0;
    const answerRows = test.questions.map((q) => {
      maxScore += q.points;
      const given = (answers[q.id] ?? []).map(String);
      let isCorrect = false;
      if (q.type === 'number') {
        isCorrect = given.length > 0 && q.correctAnswers.length > 0 && Number(given[0]) === Number(q.correctAnswers[0]);
      } else if (q.type === 'single' || q.type === 'multiple') {
        isCorrect = q.correctAnswers.length > 0 && eqSet(given, q.correctAnswers);
      } // text — авто не проверяем
      const pointsAwarded = isCorrect ? q.points : 0;
      score += pointsAwarded;
      return { questionId: q.id, answer: given, isCorrect, pointsAwarded };
    });

    // одна попытка: удалить старую, создать новую
    await prisma.testAttempt.deleteMany({ where: { testId: id, studentId: self.id } });
    const attempt = await prisma.testAttempt.create({
      data: { testId: id, studentId: self.id, score, maxScore, answers: { create: answerRows } },
    });

    return successResponse({ attemptId: attempt.id, score, maxScore });
  } catch (error) {
    console.error('POST /api/v1/tests/[id]/submit error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сдать тест', 500);
  }
}
