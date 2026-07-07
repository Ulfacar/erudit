import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

type AiFeedbackBody = {
  caseId?: unknown;
  sessionId?: unknown;
  rating?: unknown;
  source?: unknown;
  comment?: unknown;
};

const AI_FEEDBACK_SOURCES = ['llm', 'local'] as const;
type AiFeedbackSource = (typeof AI_FEEDBACK_SOURCES)[number];

function isAiFeedbackSource(value: unknown): value is AiFeedbackSource {
  return typeof value === 'string' && AI_FEEDBACK_SOURCES.includes(value as AiFeedbackSource);
}

/**
 * POST /api/v1/psy/ai-feedback — сохранить оценку качества ИИ-черновика DAP.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => ({}))) as AiFeedbackBody;
  const { caseId, sessionId, rating, source, comment } = body;

  if (typeof caseId !== 'string' || !caseId) return errorResponse('VALIDATION_ERROR', 'Нужен caseId');

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, caseId))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);
  }

  const ratingValue = Number.isInteger(rating) ? (rating as number) : null;
  if (ratingValue === null || ratingValue < 1 || ratingValue > 5) {
    return errorResponse('VALIDATION_ERROR', 'rating должен быть целым числом от 1 до 5');
  }
  if (source != null && !isAiFeedbackSource(source)) {
    return errorResponse('VALIDATION_ERROR', 'source должен быть llm, local или null');
  }

  const normalizedSource = isAiFeedbackSource(source) ? source : null;

  try {
    const created = await prisma.psyAiFeedback.create({
      data: {
        caseId,
        sessionId: typeof sessionId === 'string' && sessionId ? sessionId : null,
        rating: ratingValue,
        source: normalizedSource,
        comment: typeof comment === 'string' ? comment.trim() || null : null,
        createdBy: auth.session.user.id,
      },
    });

    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/ai-feedback error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить оценку ИИ-черновика', 500);
  }
}
