import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

/**
 * GET /api/v1/schedule/teacher-today
 * Уроки текущего учителя на сегодня (для cockpit «Сегодня»).
 * teacherId берётся из сессии — приватность гарантирована, query не доверяем.
 * Опц. ?date=YYYY-MM-DD — для отладки/демо (иначе сегодня).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['teacher', 'curator', 'super_admin', 'zavuch'] });
    if (auth.response) return auth.response;

    const userId = auth.session.user.id;
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    const scope = await getTeacherScope(userId);
    if (!scope) {
      // не-учитель (админ/завуч) без teacher-профиля — пустой день, не ошибка
      return successResponse({ date: dateParam ?? new Date().toISOString().slice(0, 10), lessons: [] });
    }

    const today = dateParam ? new Date(dateParam) : new Date();
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // 1=Пн ... 7=Вс

    const entries = await prisma.scheduleEntry.findMany({
      where: {
        teacherId: scope.teacherId,
        dayOfWeek,
        periodStart: { lte: today },
        periodEnd: { gte: today },
      },
      include: {
        class: { select: { id: true, grade: true, letter: true } },
        subject: { select: { id: true, name: true, color: true } },
        slot: { select: { id: true, slotNumber: true, startTime: true, endTime: true, type: true } },
      },
      orderBy: { slot: { slotNumber: 'asc' } },
    });

    // Сколько оценок уже выставлено сегодня по каждому (class, subject) — чтобы показать статус «✓ выставлены»
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const lessons = await Promise.all(
      entries.map(async (e) => {
        const [gradeCount, topicRow] = await Promise.all([
          prisma.grade.count({
            where: {
              teacherId: scope.teacherId,
              subjectId: e.subjectId,
              date: { gte: dayStart, lt: dayEnd },
              student: { classId: e.classId },
            },
          }),
          prisma.lessonTopic.findUnique({
            where: { classId_subjectId_date: { classId: e.classId, subjectId: e.subjectId, date: dayStart } },
            select: { topic: true },
          }),
        ]);
        return {
          scheduleId: e.id,
          classId: e.classId,
          className: `${e.class.grade}${e.class.letter}`,
          subjectId: e.subjectId,
          subjectName: e.subject.name,
          subjectColor: e.subject.color,
          slotNumber: e.slot.slotNumber,
          startTime: e.slot.startTime,
          endTime: e.slot.endTime,
          gradesEntered: gradeCount,
          topic: topicRow?.topic ?? '',
        };
      }),
    );

    return successResponse({
      date: today.toISOString().slice(0, 10),
      teacherId: scope.teacherId,
      lessons,
    });
  } catch (error) {
    console.error('GET /api/v1/schedule/teacher-today error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить уроки на сегодня', 500);
  }
}
