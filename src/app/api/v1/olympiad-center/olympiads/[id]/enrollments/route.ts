import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, type BranchScope } from '@/shared/lib/branch-scope';
import { notifyUser } from '@/shared/lib/agent/notify';

const READ_ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;
const WRITE_ROLES = ['olympiad_coach', 'super_admin', 'zavuch'] as const;

type RouteParams = { params: Promise<{ id: string }> };

function canAccessBranch(branchId: string | null, scope: BranchScope) {
  if (scope.closed) return false;
  if (scope.branchId) return branchId === scope.branchId;
  return scope.canSeeAll;
}

function className(cls?: { grade: number; letter: string } | null) {
  return cls ? `${cls.grade}${cls.letter}` : '';
}

function fio(student: { lastName: string; firstName: string; middleName?: string | null }) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

async function enrollmentPayload(olympiadId: string, scope: BranchScope) {
  const [olympiad, rows] = await Promise.all([
    prisma.olympiad.findUnique({
      where: { id: olympiadId },
      select: {
        id: true,
        name: true,
        level: true,
        stage: true,
        date: true,
        regDeadline: true,
        resultsDate: true,
        tours: true,
        awardScheme: { select: { id: true, name: true, values: true } },
      },
    }),
    prisma.olympiadParticipation.findMany({
      where: { olympiadId },
      orderBy: { enrolledAt: 'desc' },
    }),
  ]);

  if (!olympiad) return null;

  const studentIds = [...new Set(rows.map((row) => row.studentId))];
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      branchId: true,
      class: { select: { grade: true, letter: true } },
    },
  });
  const studentById = new Map(students.map((student) => [student.id, student]));
  const enrollments = rows
    .map((row) => {
      const student = studentById.get(row.studentId);
      if (!student || !canAccessBranch(student.branchId, scope)) return null;
      return {
        id: row.id,
        studentId: row.studentId,
        fio: fio(student),
        className: className(student.class),
        tour: row.tour,
        status: row.status,
        awardValue: row.awardValue,
        score: row.score,
        comment: row.comment,
      };
    })
    .filter(Boolean);

  return { olympiad, enrollments };
}

async function notifyEnrollment(student: {
  userId: string | null;
  parentLinks: { parent: { userId: string } }[];
}, olympiadName: string) {
  try {
    const recipients = new Set<string>();
    if (student.userId) recipients.add(student.userId);
    for (const link of student.parentLinks) recipients.add(link.parent.userId);

    await Promise.all(
      [...recipients].map((userId) =>
        notifyUser(userId, 'Запись на олимпиаду', `Вы записаны на олимпиаду "${olympiadName}".`),
      ),
    );
  } catch (error) {
    console.error('Olympiad enrollment notification failed:', error);
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...READ_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const payload = await enrollmentPayload(id, scope);
    if (!payload) return errorResponse('NOT_FOUND', 'Not found', 404);

    return successResponse(payload);
  } catch (error) {
    console.error('GET /api/v1/olympiad-center/olympiads/[id]/enrollments error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to load enrollments', 500);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
    const tour = typeof body.tour === 'string' && body.tour.trim() ? body.tour.trim() : null;
    if (!studentId) return errorResponse('VALIDATION_ERROR', 'studentId is required');

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const [olympiad, student] = await Promise.all([
      prisma.olympiad.findUnique({ where: { id }, select: { id: true, name: true, regDeadline: true } }),
      prisma.student.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          branchId: true,
          userId: true,
          parentLinks: { select: { parent: { select: { userId: true } } } },
        },
      }),
    ]);

    if (!olympiad || !student || !canAccessBranch(student.branchId, scope)) {
      return errorResponse('NOT_FOUND', 'Not found', 404);
    }

    if (olympiad.regDeadline && new Date() > olympiad.regDeadline && body.confirmDeadline !== true) {
      return errorResponse('DEADLINE_PASSED', 'Дедлайн регистрации прошёл — подтвердите запись', 409);
    }

    const duplicate = await prisma.olympiadParticipation.findFirst({
      where: { olympiadId: id, studentId, tour },
      select: { id: true },
    });
    if (duplicate) return errorResponse('DUPLICATE_ENROLLMENT', 'Enrollment already exists', 409);

    await prisma.olympiadParticipation.create({
      data: {
        olympiadId: id,
        studentId,
        tour,
        status: 'enrolled',
        enrolledById: auth.session.user.id,
        enrolledAt: new Date(),
      },
    });

    void notifyEnrollment(student, olympiad.name);

    const payload = await enrollmentPayload(id, scope);
    return successResponse(payload, 201);
  } catch (error) {
    console.error('POST /api/v1/olympiad-center/olympiads/[id]/enrollments error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create enrollment', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    let enrollmentId = request.nextUrl.searchParams.get('enrollmentId') ?? request.nextUrl.searchParams.get('id');
    if (!enrollmentId) {
      const body = await request.json().catch(() => null);
      enrollmentId = typeof body?.enrollmentId === 'string' ? body.enrollmentId : null;
    }
    if (!enrollmentId) return errorResponse('VALIDATION_ERROR', 'enrollmentId is required');

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const enrollment = await prisma.olympiadParticipation.findFirst({
      where: { id: enrollmentId, olympiadId: id },
      select: { id: true, studentId: true },
    });
    if (!enrollment) return errorResponse('NOT_FOUND', 'Not found', 404);

    const student = await prisma.student.findUnique({ where: { id: enrollment.studentId }, select: { branchId: true } });
    if (!student || !canAccessBranch(student.branchId, scope)) return errorResponse('NOT_FOUND', 'Not found', 404);

    await prisma.olympiadParticipation.delete({ where: { id: enrollment.id } });

    const payload = await enrollmentPayload(id, scope);
    return successResponse(payload);
  } catch (error) {
    console.error('DELETE /api/v1/olympiad-center/olympiads/[id]/enrollments error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete enrollment', 500);
  }
}
