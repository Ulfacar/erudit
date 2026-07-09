import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, canSeeFio, subjectDisplay, CASE_OWNER_ROLES, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';
import { emitSafeguardingAlert } from '@/shared/lib/psy-safeguarding';

/** GET /api/v1/psy/cases/[id] — деталь кейса (с RLS-проверкой). */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, id))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);
  }

  try {
    const c = await prisma.psyCase.findUnique({
      where: { id },
      include: {
        sessions: { orderBy: { date: 'asc' } },
        measurements: { orderBy: { date: 'asc' } },
        tests: { orderBy: { date: 'asc' } },
        referrals: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!c) return errorResponse('NOT_FOUND', 'Кейс не найден', 404);
    const student = c.studentId
      ? await prisma.student.findUnique({
          where: { id: c.studentId },
          select: { firstName: true, lastName: true, middleName: true, psyCode: true },
        })
      : null;
    return successResponse({ ...c, subjectName: canSeeFio(scope, c.ownerId) ? c.subjectName : null, subjectDisplay: subjectDisplay(scope, c, student) });
  } catch (e) {
    console.error('GET psy/cases/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Ошибка', 500);
  }
}

/** PATCH /api/v1/psy/cases/[id] — обновить статус/риск/итоговое заключение. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, id))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);
  }

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.status === 'string' && ['new', 'in_progress', 'paused', 'closed'].includes(body.status)) {
    data.status = body.status;
    if (body.status === 'closed') data.closedAt = new Date();
  }
  if (typeof body.riskLevel === 'string' && ['green', 'yellow', 'red'].includes(body.riskLevel)) {
    if (body.riskLevel === 'red' && !String(body.riskJustification ?? '').trim()) {
      return errorResponse('VALIDATION_ERROR', 'Для красного риска обязательно обоснование');
    }
    data.riskLevel = body.riskLevel;
    data.riskJustification = body.riskLevel === 'red' ? String(body.riskJustification).trim() : null;
  }
  if (typeof body.summary === 'string') data.summary = body.summary;
  if (Object.keys(data).length === 0) return errorResponse('VALIDATION_ERROR', 'Нет полей для обновления');

  try {
    const updated = await prisma.psyCase.update({ where: { id }, data });
    // UC-5: эскалация до красного риска → слепой safeguarding-алерт.
    if (data.riskLevel === 'red') await emitSafeguardingAlert(id, String(data.riskJustification ?? body.riskJustification ?? ''));
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH psy/cases/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить кейс', 500);
  }
}
