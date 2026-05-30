import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * Опросы / голосования (EduPage, Модуль 5).
 * GET — опросы, видимые роли (audience пуст = всем) + результаты + мой голос.
 * POST — создать опрос (staff).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    const surveys = await prisma.survey.findMany({
      include: { votes: { select: { userId: true, optionIndex: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const visible = surveys.filter((s) => s.audience.length === 0 || s.audience.includes(role));
    const data = visible.map((s) => {
      const counts = s.options.map((_, i) => s.votes.filter((v) => v.optionIndex === i).length);
      const myVote = s.votes.find((v) => v.userId === userId)?.optionIndex ?? null;
      return {
        id: s.id, title: s.title, description: s.description, options: s.options,
        closesAt: s.closesAt, createdAt: s.createdAt,
        counts, total: s.votes.length, myVote,
      };
    });
    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/surveys error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить опросы', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { title, description, options, audience, closesAt } = body;
    if (!title || !Array.isArray(options) || options.filter((o: string) => o?.trim()).length < 2) {
      return errorResponse('VALIDATION_ERROR', 'Нужны заголовок и минимум 2 варианта ответа');
    }
    const survey = await prisma.survey.create({
      data: {
        title,
        description: description ?? null,
        options: options.filter((o: string) => o?.trim()),
        audience: Array.isArray(audience) ? audience : [],
        authorId: auth.session.user.id,
        closesAt: closesAt ? new Date(closesAt) : null,
      },
    });
    return successResponse(survey, 201);
  } catch (error) {
    console.error('POST /api/v1/surveys error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать опрос', 500);
  }
}
