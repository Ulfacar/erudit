import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';

/**
 * GET /api/v1/psy/appointments?from=&to= — приёмы/встречи психолога (свой календарь).
 * POST — создать встречу.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const at = from || to ? { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } : undefined;

  try {
    const items = await prisma.psyAppointment.findMany({
      where: { psychologistId: auth.session.user.id, ...(at ? { at } : {}) },
      orderBy: { at: 'asc' },
    });
    return successResponse(items);
  } catch (e) {
    console.error('GET psy/appointments error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить календарь', 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { at, kind, withType, withId, withName, topic, durationMin, note } = body as Record<string, unknown>;

  if (!at || !topic || !withType) {
    return errorResponse('VALIDATION_ERROR', 'Нужны дата/время, тема и тип встречи');
  }
  const kindVal = ['individual', 'personal', 'group'].includes(String(kind)) ? String(kind) : 'individual';
  const withTypeVal = ['student', 'teacher', 'parent', 'seminar'].includes(String(withType)) ? String(withType) : 'student';

  try {
    const created = await prisma.psyAppointment.create({
      data: {
        psychologistId: auth.session.user.id,
        at: new Date(String(at)),
        durationMin: durationMin != null ? parseInt(String(durationMin), 10) || null : null,
        kind: kindVal,
        withType: withTypeVal,
        withId: withId ? String(withId) : null,
        withName: withName ? String(withName) : null,
        topic: String(topic),
        note: note ? String(note) : null,
      },
    });
    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/appointments error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать встречу', 500);
  }
}
