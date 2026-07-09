import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, type BranchScope } from '@/shared/lib/branch-scope';

const READ_ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;
const WRITE_ROLES = ['olympiad_coach', 'super_admin', 'zavuch'] as const;

type RouteParams = { params: Promise<{ id: string }> };

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
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const intensive = await findAccessibleIntensive(id, scope);
    if (!intensive) return errorResponse('NOT_FOUND', 'Not found', 404);

    return successResponse(await participantsWithStudents(id));
  } catch (error) {
    console.error('GET /api/v1/olympiad-center/intensives/[id]/participants error:', error);
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

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const intensive = await findAccessibleIntensive(id, scope);
    if (!intensive) return errorResponse('NOT_FOUND', 'Интенсив не найден', 404);

    const existingStudent = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, branchId: true } });
    if (!existingStudent) return errorResponse('NOT_FOUND', 'Not found', 404);
    if (!canAccessBranch(existingStudent.branchId, scope)) return errorResponse('NOT_FOUND', 'Not found', 404);
    if (intensive.branchId !== existingStudent.branchId) return errorResponse('NOT_FOUND', 'Not found', 404);

    const participant = await prisma.$transaction(async (tx) => {
      await tx.student.update({ where: { id: studentId }, data: { isOlympian: true } });
      return tx.intensiveParticipant.upsert({
        where: { intensiveId_studentId: { intensiveId: id, studentId } },
        create: { intensiveId: id, studentId },
        update: {},
      });
    });

    const student = await prisma.student.findUnique({ where: { id: studentId }, include: { class: true } });
    return successResponse({
      ...participant,
      student: student ? { id: student.id, firstName: student.firstName, lastName: student.lastName, middleName: student.middleName, fio: fio(student), className: className(student.class) } : null,
    }, 201);
  } catch (error) {
    console.error('POST /api/v1/olympiad-center/intensives/[id]/participants error:', error);
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

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const intensive = await findAccessibleIntensive(id, scope);
    if (!intensive) return errorResponse('NOT_FOUND', 'Not found', 404);

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, branchId: true } });
    if (!student) return errorResponse('NOT_FOUND', 'Not found', 404);
    if (!canAccessBranch(student.branchId, scope)) return errorResponse('NOT_FOUND', 'Not found', 404);

    await prisma.$transaction(async (tx) => {
      await tx.intensiveParticipant.deleteMany({ where: { intensiveId: id, studentId } });
      const remaining = await tx.intensiveParticipant.count({ where: { studentId } });
      if (remaining === 0) {
        await tx.student.update({ where: { id: studentId }, data: { isOlympian: false } });
      }
    });
    return successResponse({ intensiveId: id, studentId });
  } catch (error) {
    console.error('DELETE /api/v1/olympiad-center/intensives/[id]/participants error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить участника', 500);
  }
}
