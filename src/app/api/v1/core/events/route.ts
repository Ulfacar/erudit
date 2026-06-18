import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/core/events?since=<iso> — живые события ядра для нейро-графа.
 * Реальные AgentEvent транслируются в пути по узлам графа (те же id-конвенции,
 * что в /api/v1/core/graph): поставили оценку → импульс реально летит
 * учитель → Журнал → ядро → класс → ученик (→ родитель).
 */

interface LiveEvent {
  id: string;
  type: string;
  path: string[];
  caption: string;
  at: string;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin'] });
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60_000);
    if (Number.isNaN(since.getTime())) return errorResponse('VALIDATION_ERROR', 'Некорректный since');

    const now = new Date();
    const events = await prisma.agentEvent.findMany({
      where: { createdAt: { gt: since, lte: now } },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { id: true, type: true, actorUserId: true, studentId: true, classId: true, payload: true, createdAt: true },
    });

    if (!events.length) return successResponse({ events: [], now: now.toISOString() });

    // lookups одной пачкой
    const studentIds = [...new Set(events.map((e) => e.studentId).filter((x): x is string => !!x))];
    const actorIds = [...new Set(events.map((e) => e.actorUserId).filter((x): x is string => !!x))];
    const [students, teachers, parentLinks] = await Promise.all([
      prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, classId: true, class: { select: { grade: true, letter: true } } },
      }),
      prisma.teacher.findMany({ where: { userId: { in: actorIds } }, select: { id: true, userId: true, lastName: true } }),
      prisma.parentStudent.findMany({
        where: { studentId: { in: studentIds } },
        select: { studentId: true, parentId: true },
      }),
    ]);
    const studentById = new Map(students.map((s) => [s.id, s]));
    const teacherByUser = new Map(teachers.map((t) => [t.userId, t]));
    const parentByStudent = new Map<string, string>();
    for (const pl of parentLinks) if (!parentByStudent.has(pl.studentId)) parentByStudent.set(pl.studentId, pl.parentId);

    const live: LiveEvent[] = events.map((e) => {
      const student = e.studentId ? studentById.get(e.studentId) : null;
      const sName = student ? `${student.lastName} ${student.firstName[0]}.` : 'ученик';
      const sClass = student?.class ? `${student.class.grade}${student.class.letter}` : '';
      const classId = e.classId ?? student?.classId ?? null;
      const teacher = e.actorUserId ? teacherByUser.get(e.actorUserId) : null;
      const parentId = e.studentId ? parentByStudent.get(e.studentId) : null;
      const payload = (e.payload ?? {}) as Record<string, unknown>;

      let path: string[] = ['school', 'd-agent'];
      let caption = 'Событие в ядре школы';

      if (e.type === 'grade.created') {
        path = [
          ...(teacher ? [`t-${teacher.id}`] : []),
          'd-journal',
          'school',
          ...(classId ? [`c-${classId}`] : []),
          ...(e.studentId ? [`s-${e.studentId}`] : []),
          ...(parentId ? [`p-${parentId}`] : []),
        ];
        caption = `Оценка ${payload.value ?? ''} — ${sName}${sClass ? `, ${sClass}` : ''}`;
      } else if (e.type === 'attendance.marked') {
        path = ['d-journal', 'school', ...(classId ? [`c-${classId}`] : []), ...(e.studentId ? [`s-${e.studentId}`] : [])];
        caption = `Посещаемость: ${sName}${sClass ? `, ${sClass}` : ''}`;
      } else if (e.type === 'admission.enrolled') {
        path = ['d-admission', 'school', ...(classId ? [`c-${classId}`] : []), ...(e.studentId ? [`s-${e.studentId}`] : [])];
        caption = `🎉 Зачислен новый ученик: ${sName}`;
      } else if (e.type === 'test.completed') {
        path = ['d-journal', 'school', ...(e.studentId ? [`s-${e.studentId}`] : [])];
        caption = `Тест пройден — ${sName}`;
      } else if (e.type === 'psych.case.opened') {
        path = ['d-psych', 'school', ...(classId ? [`c-${classId}`] : []), ...(e.studentId ? [`s-${e.studentId}`] : [])];
        caption = `🧠 Психолог открыл кейс — ${sName}${sClass ? `, ${sClass}` : ''}`;
      } else if (e.type === 'safeguard.alert') {
        // слепое событие: без имён (приватность ТЗ) — путь только домен → ядро
        path = ['d-safeguard', 'school'];
        caption = '🔒 Safeguarding: критический сигнал — координатору';
      } else if (e.type === 'callcenter.promise') {
        path = ['d-callcenter', 'd-finance', 'school', ...(e.studentId ? [`s-${e.studentId}`] : [])];
        caption = `🎧 Колл-центр: обещание оплаты — ${sName}`;
      } else if (e.type === 'contract.created') {
        path = ['d-contracts', 'd-finance', 'school', ...(e.studentId ? [`s-${e.studentId}`] : [])];
        caption = `📄 Договор оформлен — ${sName}`;
      } else if (e.type === 'hr.candidate.added') {
        path = ['d-hr', 'school'];
        caption = '📋 HR: новый кандидат в резерве';
      }

      return { id: e.id, type: e.type, path, caption, at: e.createdAt.toISOString() };
    });

    return successResponse({ events: live, now: now.toISOString() });
  } catch (error) {
    console.error('GET /api/v1/core/events error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось получить события', 500);
  }
}
