import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';

/** PATCH /api/v1/psy/appointments/[id] — статус (done/cancelled) или перенос (at). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => ({}));
  const { status, at, topic, note } = body as Record<string, unknown>;

  try {
    const appt = await prisma.psyAppointment.findUnique({ where: { id }, select: { psychologistId: true } });
    if (!appt) return errorResponse('NOT_FOUND', 'Встреча не найдена', 404);
    if (appt.psychologistId !== auth.session.user.id) {
      return errorResponse('FORBIDDEN', 'Это не ваша встреча', 403);
    }
    const data: Record<string, unknown> = {};
    if (status && ['scheduled', 'done', 'cancelled'].includes(String(status))) data.status = String(status);
    if (at) data.at = new Date(String(at));
    if (topic !== undefined) data.topic = String(topic);
    if (note !== undefined) data.note = note ? String(note) : null;

    const updated = await prisma.psyAppointment.update({ where: { id }, data });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH psy/appointments/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить встречу', 500);
  }
}

/** DELETE /api/v1/psy/appointments/[id] — удалить встречу. */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  try {
    const appt = await prisma.psyAppointment.findUnique({ where: { id }, select: { psychologistId: true } });
    if (!appt) return errorResponse('NOT_FOUND', 'Встреча не найдена', 404);
    if (appt.psychologistId !== auth.session.user.id) {
      return errorResponse('FORBIDDEN', 'Это не ваша встреча', 403);
    }
    await prisma.psyAppointment.delete({ where: { id } });
    return successResponse({ ok: true });
  } catch (e) {
    console.error('DELETE psy/appointments/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить встречу', 500);
  }
}
