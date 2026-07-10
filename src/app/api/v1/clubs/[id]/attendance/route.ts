import { type NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { canAccessBranch, getBranchScope } from '@/shared/lib/branch-scope';

const READ_ROLES = ['club_coach', 'super_admin', 'zavuch'] as const;
const WRITE_ROLES = ['club_coach', 'super_admin', 'zavuch'] as const;
const STATUSES = new Set(['present', 'absent', 'excused']);

type RouteParams = { params: Promise<{ id: string }> };
type AttendanceStatus = 'present' | 'absent' | 'excused';
type MarkInput = { studentId: string; date: string; status: AttendanceStatus };

function className(cls?: { grade: number; letter: string } | null) {
  return cls ? `${cls.grade}${cls.letter}` : '';
}

function fio(student: { lastName: string; firstName: string; middleName?: string | null }) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

async function findClubForUser(id: string, role: Role, userId: string, sessionBranchId?: string | null) {
  const club = await prisma.club.findUnique({ where: { id }, select: { id: true, coachId: true, branchId: true } });
  if (!club) return { status: 'not_found' as const };
  if (role === 'club_coach' && club.coachId !== userId) return { status: 'forbidden' as const };
  if (role !== 'club_coach') {
    const scope = await getBranchScope(userId, role, sessionBranchId);
    if (scope.closed) return { status: 'forbidden' as const };
    if (!canAccessBranch(scope, club.branchId)) return { status: 'not_found' as const };
  }
  return { status: 'ok' as const, club };
}

function parseDay(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function participantsWithStudents(clubId: string) {
  const participants = await prisma.clubParticipant.findMany({
    where: { clubId },
    orderBy: { addedAt: 'asc' },
  });
  const students = await prisma.student.findMany({
    where: { id: { in: participants.map((participant) => participant.studentId) } },
    include: { class: true },
  });
  const studentById = new Map(students.map((student) => [student.id, student]));

  return participants.map((participant) => {
    const student = studentById.get(participant.studentId);
    return {
      studentId: participant.studentId,
      fio: student ? fio(student) : participant.studentId,
      className: student ? className(student.class) : '',
    };
  });
}

async function attendanceGrid(clubId: string) {
  const [sessions, participants, marks] = await Promise.all([
    prisma.clubSession.findMany({ where: { clubId }, orderBy: { date: 'asc' } }),
    participantsWithStudents(clubId),
    prisma.clubAttendance.findMany({
      where: { clubId },
      select: { studentId: true, date: true, status: true },
      orderBy: [{ date: 'asc' }, { studentId: 'asc' }],
    }),
  ]);

  return {
    sessions,
    participants,
    marks: marks.map((mark) => ({ studentId: mark.studentId, date: isoDay(mark.date), status: mark.status })),
  };
}

function parseMark(value: unknown): MarkInput | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const studentId = String(source.studentId || '').trim();
  const date = typeof source.date === 'string' ? source.date : '';
  const status = typeof source.status === 'string' ? source.status : '';
  if (!studentId || !parseDay(date) || !STATUSES.has(status)) return null;
  return { studentId, date, status: status as AttendanceStatus };
}

async function buildMarks(clubId: string, body: Record<string, unknown>) {
  if (Array.isArray(body.marks)) {
    const marks = body.marks.map(parseMark);
    if (marks.some((mark) => !mark)) return { error: true as const };
    return { marks: marks as MarkInput[] };
  }

  if (body.all === true) {
    const date = typeof body.date === 'string' ? body.date : '';
    const status = typeof body.status === 'string' ? body.status : '';
    if (!parseDay(date) || !STATUSES.has(status)) return { error: true as const };
    const participants = await prisma.clubParticipant.findMany({
      where: { clubId },
      select: { studentId: true },
      orderBy: { addedAt: 'asc' },
    });
    return { marks: participants.map((participant) => ({ studentId: participant.studentId, date, status: status as AttendanceStatus })) };
  }

  const mark = parseMark(body);
  return mark ? { marks: [mark] } : { error: true as const };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...READ_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const access = await findClubForUser(id, auth.session.user.role, auth.session.user.id, auth.session.user.branchId);
    if (access.status === 'not_found') return errorResponse('NOT_FOUND', 'Not found', 404);
    if (access.status === 'forbidden') return errorResponse('FORBIDDEN', 'Forbidden', 403);

    return successResponse(await attendanceGrid(id));
  } catch (error) {
    console.error('GET /api/v1/clubs/[id]/attendance error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить журнал посещаемости', 500);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const access = await findClubForUser(id, auth.session.user.role, auth.session.user.id, auth.session.user.branchId);
    if (access.status === 'not_found') return errorResponse('NOT_FOUND', 'Not found', 404);
    if (access.status === 'forbidden') return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const parsed = await buildMarks(id, body);
    if ('error' in parsed) return errorResponse('VALIDATION_ERROR', 'Некорректные отметки');

    const [sessions, participants] = await Promise.all([
      prisma.clubSession.findMany({ where: { clubId: id }, select: { date: true } }),
      prisma.clubParticipant.findMany({ where: { clubId: id }, select: { studentId: true } }),
    ]);
    const allowedDays = new Set(sessions.map((session) => isoDay(session.date)));
    const allowedStudents = new Set(participants.map((participant) => participant.studentId));

    if (parsed.marks.some((mark) => !allowedDays.has(mark.date) || !allowedStudents.has(mark.studentId))) {
      return errorResponse('VALIDATION_ERROR', 'Дата или участник не входит в кружок');
    }

    await prisma.$transaction(
      parsed.marks.map((mark) => {
        const date = parseDay(mark.date);
        if (!date) throw new Error('INVALID_MARK');
        return prisma.clubAttendance.upsert({
          where: { clubId_studentId_date: { clubId: id, studentId: mark.studentId, date } },
          create: { clubId: id, studentId: mark.studentId, date, status: mark.status, markedById: auth.session.user.id, markedAt: new Date() },
          update: { status: mark.status, markedById: auth.session.user.id, markedAt: new Date() },
        });
      }),
    );

    return successResponse(await attendanceGrid(id));
  } catch (error) {
    console.error('POST /api/v1/clubs/[id]/attendance error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить посещаемость', 500);
  }
}
