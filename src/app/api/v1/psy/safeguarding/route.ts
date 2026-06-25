import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { COORDINATOR_ROLES, escalateStaleAlerts } from '@/shared/lib/psy-safeguarding';

/**
 * GET /api/v1/psy/safeguarding — закрытый контур координатора безопасности.
 * Раскрываем ИНИЦИАЛЫ ученика + причину (UC-5: «Кейс ученика А.Б. Причина: …»),
 * но не полные ФИО/тексты сессий. Доступ — только координатор/завуч/директор.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...COORDINATOR_ROLES] });
  if (auth.response) return auth.response;

  try {
    // Ленивый прогон авто-эскалации при каждом открытии контура (на случай,
    // если cron не настроен — на on-prem без планировщика). Best-effort.
    await escalateStaleAlerts().catch((e) => console.error('escalateStaleAlerts (on-read) failed:', e));

    const alerts = await prisma.psyAlert.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] });
    const caseIds = [...new Set(alerts.map((a) => a.caseId))];
    const cases = await prisma.psyCase.findMany({ where: { id: { in: caseIds } }, select: { id: true, studentId: true, riskLevel: true } });
    const studentIds = [...new Set(cases.map((c) => c.studentId).filter((x): x is string => !!x))];
    const students = await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true } });

    const initials = (sid: string) => {
      const s = students.find((x) => x.id === sid);
      return s ? `${s.lastName[0] ?? ''}.${s.firstName[0] ?? ''}.` : '—';
    };
    const result = alerts.map((a) => {
      const c = cases.find((x) => x.id === a.caseId);
      return {
        id: a.id, status: a.status, createdAt: a.createdAt, reason: a.reason,
        studentInitials: c && c.studentId ? initials(c.studentId) : '—',
        riskLevel: c?.riskLevel ?? 'red',
        escalatedAt: a.escalatedAt, remindCount: a.remindCount,
      };
    });
    return successResponse(result);
  } catch (e) {
    console.error('GET psy/safeguarding error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить алерты', 500);
  }
}

/** PATCH /api/v1/psy/safeguarding — взять в работу / закрыть алерт. */
export async function PATCH(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...COORDINATOR_ROLES] });
  if (auth.response) return auth.response;

  const { alertId, status } = (await request.json().catch(() => ({}))) as { alertId?: string; status?: string };
  if (!alertId || !['in_progress', 'resolved'].includes(status ?? '')) {
    return errorResponse('VALIDATION_ERROR', 'Нужны alertId и status (in_progress|resolved)');
  }
  try {
    const updated = await prisma.psyAlert.update({
      where: { id: alertId },
      data: { status: status as 'in_progress', takenBy: auth.session.user.id, takenAt: new Date() },
    });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH psy/safeguarding error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить алерт', 500);
  }
}
