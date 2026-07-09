import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, type BranchScope } from '@/shared/lib/branch-scope';

const READ_ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;
const WRITE_ROLES = ['olympiad_coach', 'super_admin', 'zavuch'] as const;
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

function canAccessBranch(branchId: string | null, scope: BranchScope) {
  if (scope.closed) return false;
  if (scope.branchId) return branchId === scope.branchId;
  return scope.canSeeAll;
}

async function findAccessibleIntensive(id: string, scope: BranchScope) {
  const intensive = await prisma.intensive.findUnique({ where: { id }, select: { id: true, branchId: true } });
  if (!intensive || !canAccessBranch(intensive.branchId, scope)) return null;
  return intensive;
}

function parseDay(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function participantsWithStudents(intensiveId: string) {
  const participants = await prisma.intensiveParticipant.findMany({
    where: { intensiveId },
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

async function attendanceGrid(intensiveId: string) {
  const [days, participants, marks] = await Promise.all([
    prisma.intensiveDay.findMany({ where: { intensiveId }, orderBy: { date: 'asc' } }),
    participantsWithStudents(intensiveId),
    prisma.intensiveAttendance.findMany({
      where: { intensiveId },
      select: { studentId: true, date: true, status: true },
      orderBy: [{ date: 'asc' }, { studentId: 'asc' }],
    }),
  ]);

  return {
    days,
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

async function buildMarks(intensiveId: string, body: Record<string, unknown>) {
  if (Array.isArray(body.marks)) {
    const marks = body.marks.map(parseMark);
    if (marks.some((mark) => !mark)) return { error: true as const };
    return { marks: marks as MarkInput[] };
  }

  if (body.all === true) {
    const date = typeof body.date === 'string' ? body.date : '';
    const status = typeof body.status === 'string' ? body.status : '';
    if (!parseDay(date) || !STATUSES.has(status)) return { error: true as const };
    const participants = await prisma.intensiveParticipant.findMany({
      where: { intensiveId },
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
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const intensive = await findAccessibleIntensive(id, scope);
    if (!intensive) return errorResponse('NOT_FOUND', 'Not found', 404);

    return successResponse(await attendanceGrid(id));
  } catch (error) {
    console.error('GET /api/v1/olympiad-center/intensives/[id]/attendance error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить журнал посещаемости', 500);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const intensive = await findAccessibleIntensive(id, scope);
    if (!intensive) return errorResponse('NOT_FOUND', 'Not found', 404);

    const parsed = await buildMarks(id, body);
    if ('error' in parsed) return errorResponse('VALIDATION_ERROR', 'Некорректные отметки');

    const [days, participants] = await Promise.all([
      prisma.intensiveDay.findMany({ where: { intensiveId: id }, select: { date: true } }),
      prisma.intensiveParticipant.findMany({ where: { intensiveId: id }, select: { studentId: true } }),
    ]);
    const allowedDays = new Set(days.map((day) => isoDay(day.date)));
    const allowedStudents = new Set(participants.map((participant) => participant.studentId));

    if (parsed.marks.some((mark) => !allowedDays.has(mark.date) || !allowedStudents.has(mark.studentId))) {
      return errorResponse('VALIDATION_ERROR', 'Дата или участник не входит в интенсив');
    }

    await prisma.$transaction(
      parsed.marks.map((mark) => {
        const date = parseDay(mark.date);
        if (!date) throw new Error('INVALID_MARK');
        return prisma.intensiveAttendance.upsert({
          where: { intensiveId_studentId_date: { intensiveId: id, studentId: mark.studentId, date } },
          create: { intensiveId: id, studentId: mark.studentId, date, status: mark.status, markedById: auth.session.user.id, markedAt: new Date() },
          update: { status: mark.status, markedById: auth.session.user.id, markedAt: new Date() },
        });
      }),
    );

    return successResponse(await attendanceGrid(id));
  } catch (error) {
    console.error('POST /api/v1/olympiad-center/intensives/[id]/attendance error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить посещаемость', 500);
  }
}
