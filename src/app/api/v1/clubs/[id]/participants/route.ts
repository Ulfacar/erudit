import { type NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { canAccessStudent } from '@/shared/lib/student-access';
import { canAccessBranch, getBranchScope } from '@/shared/lib/branch-scope';

const READ_ROLES = ['club_coach', 'super_admin', 'zavuch'] as const;
const WRITE_ROLES = ['club_coach', 'super_admin', 'zavuch'] as const;

type RouteParams = { params: Promise<{ id: string }> };

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
      ...participant,
      student: student
        ? { id: student.id, firstName: student.firstName, lastName: student.lastName, middleName: student.middleName, fio: fio(student), className: className(student.class) }
        : null,
    };
  });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...READ_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const access = await findClubForUser(id, auth.session.user.role, auth.session.user.id, auth.session.user.branchId);
    if (access.status === 'not_found') return errorResponse('NOT_FOUND', 'Not found', 404);
    if (access.status === 'forbidden') return errorResponse('FORBIDDEN', 'Forbidden', 403);

    return successResponse(await participantsWithStudents(id));
  } catch (error) {
    console.error('GET /api/v1/clubs/[id]/participants error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить участников', 500);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const studentId = String(body.studentId || '').trim();
    if (!studentId) return errorResponse('VALIDATION_ERROR', 'studentId обязателен');

    const access = await findClubForUser(id, auth.session.user.role, auth.session.user.id, auth.session.user.branchId);
    if (access.status === 'not_found') return errorResponse('NOT_FOUND', 'Кружок не найден', 404);
    if (access.status === 'forbidden') return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const student = await prisma.student.findUnique({ where: { id: studentId }, include: { class: true } });
    if (!student) return errorResponse('NOT_FOUND', 'Not found', 404);
    if (access.club.branchId && access.club.branchId !== student.branchId) return errorResponse('NOT_FOUND', 'Not found', 404);

    const allowed = await canAccessStudent(auth.session.user.role, auth.session.user.id, studentId, auth.session.user.branchId);
    if (!allowed) return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const participant = await prisma.clubParticipant.upsert({
      where: { clubId_studentId: { clubId: id, studentId } },
      create: { clubId: id, studentId },
      update: {},
    });

    return successResponse({
      ...participant,
      student: { id: student.id, firstName: student.firstName, lastName: student.lastName, middleName: student.middleName, fio: fio(student), className: className(student.class) },
    }, 201);
  } catch (error) {
    console.error('POST /api/v1/clubs/[id]/participants error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось добавить участника', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = request.headers.get('content-type')?.includes('application/json') ? await request.json().catch(() => ({})) : {};
    const studentId = String(body.studentId || request.nextUrl.searchParams.get('studentId') || '').trim();
    if (!studentId) return errorResponse('VALIDATION_ERROR', 'studentId обязателен');

    const access = await findClubForUser(id, auth.session.user.role, auth.session.user.id, auth.session.user.branchId);
    if (access.status === 'not_found') return errorResponse('NOT_FOUND', 'Not found', 404);
    if (access.status === 'forbidden') return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const allowed = await canAccessStudent(auth.session.user.role, auth.session.user.id, studentId, auth.session.user.branchId);
    if (!allowed) return errorResponse('FORBIDDEN', 'Forbidden', 403);

    await prisma.clubParticipant.deleteMany({ where: { clubId: id, studentId } });
    return successResponse({ clubId: id, studentId });
  } catch (error) {
    console.error('DELETE /api/v1/clubs/[id]/participants error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить участника', 500);
  }
}
