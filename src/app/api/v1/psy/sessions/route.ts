import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';

const SESSION_TYPES = ['primary_diagnosis', 'planned', 'emergency', 'parent_meeting', 'teacher_meeting', 'group'];

/** GET /api/v1/psy/sessions?caseId= — сессии кейса (под RLS кейса). */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  const caseId = new URL(request.url).searchParams.get('caseId');
  if (!caseId) return errorResponse('VALIDATION_ERROR', 'Параметр caseId обязателен');

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, caseId))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);
  }

  try {
    const sessions = await prisma.psySession.findMany({ where: { caseId }, orderBy: { date: 'asc' } });
    return successResponse(sessions);
  } catch (e) {
    console.error('GET psy/sessions error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить сессии', 500);
  }
}

/** POST /api/v1/psy/sessions — добавить сессию в кейс. authorId = текущий психолог. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { caseId, type, date, templateId, rawNote, dapData, dapAssessment, dapPlan, qualNote, interventionId } = body as Record<string, string>;
  if (!caseId) return errorResponse('VALIDATION_ERROR', 'Параметр caseId обязателен');
  if (!dapData?.trim()) return errorResponse('VALIDATION_ERROR', 'Поле D (Data) обязательно');

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, caseId))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);
  }

  try {
    let validInterventionId: string | null = null;
    if (interventionId) {
      const intervention = await prisma.psyIntervention.findFirst({
        where: { id: interventionId, caseId, status: 'active' },
        select: { id: true },
      });
      if (!intervention) return errorResponse('VALIDATION_ERROR', 'Некорректная интервенция');
      validInterventionId = intervention.id;
    }

    const created = await prisma.psySession.create({
      data: {
        interventionId: validInterventionId,
        caseId,
        authorId: auth.session.user.id,
        type: (SESSION_TYPES.includes(type) ? type : 'planned') as 'planned',
        date: date ? new Date(date) : new Date(),
        templateId: templateId || null,
        rawNote: rawNote || null,
        dapData: dapData || null,
        dapAssessment: dapAssessment || null,
        dapPlan: dapPlan || null,
        qualNote: qualNote || null,
      },
    });
    // первая сессия двигает кейс из «new» в «in_progress»
    await prisma.psyCase.update({ where: { id: caseId }, data: { status: 'in_progress' } }).catch(() => {});
    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/sessions error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать сессию', 500);
  }
}
