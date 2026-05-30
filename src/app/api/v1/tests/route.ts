import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * Тесты с автопроверкой (EduPage e-learning, Модуль 8).
 * GET — учитель видит свои тесты; ученик — опубликованные для своего класса (+ свой результат).
 * POST — учитель создаёт тест с вопросами.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    if (role === 'student') {
      const self = await prisma.student.findFirst({ where: { userId }, select: { id: true, classId: true } });
      if (!self) return errorResponse('FORBIDDEN', 'Нет доступа', 403);
      const tests = await prisma.test.findMany({
        where: { status: 'published', OR: [{ classId: self.classId }, { classId: null }] },
        include: { _count: { select: { questions: true } }, attempts: { where: { studentId: self.id }, select: { score: true, maxScore: true } } },
        orderBy: { createdAt: 'desc' },
      });
      const data = tests.map((t) => ({
        id: t.id, title: t.title, description: t.description, questionCount: t._count.questions,
        myAttempt: t.attempts[0] ? { score: t.attempts[0].score, maxScore: t.attempts[0].maxScore } : null,
      }));
      return successResponse(data);
    }

    // staff: свои (или все для админа/завуча)
    const where: Record<string, unknown> = {};
    if (role === 'teacher' || role === 'curator') where.authorId = userId;
    const tests = await prisma.test.findMany({
      where,
      include: { _count: { select: { questions: true, attempts: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const data = tests.map((t) => ({
      id: t.id, title: t.title, description: t.description, status: t.status, classId: t.classId,
      questionCount: t._count.questions, attemptCount: t._count.attempts,
    }));
    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/tests error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить тесты', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['teacher', 'curator', 'zavuch', 'super_admin'] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { title, description, subjectId, classId, questions } = body;
    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return errorResponse('VALIDATION_ERROR', 'Нужны заголовок и хотя бы один вопрос');
    }

    const test = await prisma.test.create({
      data: {
        title,
        description: description ?? null,
        subjectId: subjectId || null,
        classId: classId || null,
        authorId: auth.session.user.id,
        status: 'published',
        questions: {
          create: questions.map((q: Record<string, unknown>, i: number) => ({
            order: i,
            text: String(q.text ?? ''),
            type: (['single', 'multiple', 'number', 'text'].includes(String(q.type)) ? q.type : 'single') as 'single' | 'multiple' | 'number' | 'text',
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
            correctAnswers: Array.isArray(q.correctAnswers) ? (q.correctAnswers as string[]).map(String) : [],
            points: Number(q.points) || 1,
          })),
        },
      },
      include: { _count: { select: { questions: true } } },
    });
    return successResponse(test, 201);
  } catch (error) {
    console.error('POST /api/v1/tests error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать тест', 500);
  }
}
