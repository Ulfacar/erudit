import { type NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { branchWhere, getBranchScope } from '@/shared/lib/branch-scope';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];

function parseWeeks(value: string | null) {
  const weeks = Number(value ?? 4);
  if (!Number.isFinite(weeks) || weeks <= 0) return 4;
  return Math.min(Math.floor(weeks), 52);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ZVR_ROLES] });
    if (auth.response) return auth.response;

    const weeks = parseWeeks(request.nextUrl.searchParams.get('weeks'));
    const now = new Date();
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const scope = await getBranchScope(
      auth.session.user.id,
      auth.session.user.role as Role,
      auth.session.user.branchId,
    );

    const classes = await prisma.class.findMany({
      where: branchWhere(scope),
      select: { id: true, grade: true, letter: true },
      orderBy: [{ grade: 'asc' }, { letter: 'asc' }],
    });

    const classIds = new Set(classes.map((item) => item.id));
    const events = await prisma.schoolEvent.findMany({
      where: { date: { gte: since, lte: now } },
      select: { id: true, date: true },
    });
    const eventById = new Map(events.map((event) => [event.id, event]));
    const eventIds = events.map((event) => event.id);

    const participants = eventIds.length > 0
      ? await prisma.eventParticipant.findMany({
        where: { eventId: { in: eventIds } },
        select: { eventId: true, studentId: true },
      })
      : [];

    const studentIds = [...new Set(participants.map((participant) => participant.studentId))];
    const students = studentIds.length > 0
      ? await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, classId: true },
      })
      : [];
    const classByStudentId = new Map(students.map((student) => [student.id, student.classId]));

    const eventIdsByClass = new Map<string, Set<string>>();
    const lastParticipationByClass = new Map<string, Date>();

    for (const participant of participants) {
      const classId = classByStudentId.get(participant.studentId);
      const event = eventById.get(participant.eventId);
      if (!classId || !event || !classIds.has(classId)) continue;

      if (!eventIdsByClass.has(classId)) eventIdsByClass.set(classId, new Set());
      eventIdsByClass.get(classId)!.add(participant.eventId);

      const previous = lastParticipationByClass.get(classId);
      if (!previous || event.date > previous) {
        lastParticipationByClass.set(classId, event.date);
      }
    }

    const data = classes
      .map((item) => {
        const participatedEvents = eventIdsByClass.get(item.id)?.size ?? 0;
        return {
          classId: item.id,
          className: `${item.grade}${item.letter}`,
          participatedEvents,
          lastParticipation: lastParticipationByClass.get(item.id)?.toISOString() ?? null,
          isolated: participatedEvents === 0,
        };
      })
      .sort((a, b) => {
        if (a.isolated !== b.isolated) return a.isolated ? -1 : 1;
        if (a.participatedEvents !== b.participatedEvents) return a.participatedEvents - b.participatedEvents;
        return a.className.localeCompare(b.className, 'ru');
      });

    return successResponse(data);
  } catch (error) {
    console.error('GET /api/v1/zvr/cohesion error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить радар сплочения', 500);
  }
}
