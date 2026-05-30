import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * POST /api/v1/surveys/vote  { surveyId, optionIndex }
 * Любой авторизованный голосует (один голос на пользователя, можно переголосовать).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.session.user.id;
    const { surveyId, optionIndex } = await request.json();
    if (!surveyId || optionIndex === undefined || optionIndex === null) {
      return errorResponse('VALIDATION_ERROR', 'Поля surveyId и optionIndex обязательны');
    }

    const survey = await prisma.survey.findUnique({ where: { id: surveyId }, select: { options: true, closesAt: true } });
    if (!survey) return errorResponse('NOT_FOUND', 'Опрос не найден', 404);
    if (survey.closesAt && new Date(survey.closesAt) < new Date()) {
      return errorResponse('FORBIDDEN', 'Опрос завершён', 403);
    }
    if (optionIndex < 0 || optionIndex >= survey.options.length) {
      return errorResponse('VALIDATION_ERROR', 'Недопустимый вариант');
    }

    const vote = await prisma.surveyVote.upsert({
      where: { surveyId_userId: { surveyId, userId } },
      update: { optionIndex },
      create: { surveyId, userId, optionIndex },
    });
    return successResponse(vote);
  } catch (error) {
    console.error('POST /api/v1/surveys/vote error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось проголосовать', 500);
  }
}
