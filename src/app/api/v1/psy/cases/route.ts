import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, caseWhereForScope, CASE_OWNER_ROLES, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';
import { emitSafeguardingAlert } from '@/shared/lib/psy-safeguarding';
import { emitEvent } from '@/shared/lib/agent/engine';

/** GET /api/v1/psy/cases?studentId=&status=&riskLevel= — список кейсов под RLS. */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  const where = await caseWhereForScope(scope);

  const { searchParams } = new URL(request.url);
  for (const p of ['studentId', 'status', 'riskLevel', 'subjectType'] as const) {
    const v = searchParams.get(p);
    if (v) (where as Record<string, unknown>)[p] = v;
  }

  try {
    const cases = await prisma.psyCase.findMany({
      where,
      orderBy: [{ riskLevel: 'desc' }, { updatedAt: 'desc' }],
      include: { _count: { select: { sessions: true } } },
    });
    return successResponse(cases);
  } catch (e) {
    console.error('GET psy/cases error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить кейсы', 500);
  }
}

/** POST /api/v1/psy/cases — создать кейс. owner = текущий психолог. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { studentId, title, reason, riskLevel, riskJustification, subjectId, subjectName } = body as Record<string, string>;
  // Этап 9: субъект кейса — ученик (по умолчанию) / родитель / учитель / группа.
  const subjectType = (['student', 'parent', 'teacher', 'group'].includes(body.subjectType) ? body.subjectType : 'student') as 'student' | 'parent' | 'teacher' | 'group';

  if (!title?.trim()) {
    return errorResponse('VALIDATION_ERROR', 'Нужно название кейса');
  }
  if (subjectType === 'student') {
    if (!studentId) return errorResponse('VALIDATION_ERROR', 'Нужен ученик');
  } else if (!subjectId || !subjectName?.trim()) {
    return errorResponse('VALIDATION_ERROR', 'Нужно выбрать субъект кейса');
  }
  const risk = (['green', 'yellow', 'red'].includes(riskLevel) ? riskLevel : 'green') as 'green' | 'yellow' | 'red';
  // Патч безопасности: красный риск требует текстового обоснования.
  if (risk === 'red' && !riskJustification?.trim()) {
    return errorResponse('VALIDATION_ERROR', 'Для красного риска обязательно текстовое обоснование');
  }

  try {
    const created = await prisma.psyCase.create({
      data: {
        subjectType,
        studentId: subjectType === 'student' ? studentId : null,
        subjectId: subjectType === 'student' ? studentId : subjectId,
        subjectName: subjectType === 'student' ? null : subjectName!.trim(),
        ownerId: auth.session.user.id,
        title: title.trim(),
        reason: reason?.trim() || null,
        riskLevel: risk,
        riskJustification: risk === 'red' ? riskJustification!.trim() : null,
        status: 'new',
      },
    });
    // UC-5: красный риск → слепой safeguarding-алерт координаторам.
    if (risk === 'red') await emitSafeguardingAlert(created.id, riskJustification!.trim());
    // Ядро: импульс «психолог открыл кейс» в нейро-граф (live-событие) — только по ученику.
    if (subjectType === 'student') {
      await emitEvent('psych.case.opened', { actorUserId: auth.session.user.id, studentId: studentId!, payload: { caseId: created.id, risk } });
    }
    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/cases error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать кейс', 500);
  }
}
