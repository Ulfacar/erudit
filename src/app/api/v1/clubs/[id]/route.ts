import { type NextRequest } from 'next/server';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { canAccessBranch, getBranchScope } from '@/shared/lib/branch-scope';
import { roleMatches } from '@/shared/lib/role-access';

const READ_ROLES = ['club_coach', 'super_admin', 'zavuch'] as const;
const WRITE_ROLES = ['club_coach', 'super_admin', 'zavuch'] as const;
const STATUSES = new Set(['active', 'archived']);

type RouteParams = { params: Promise<{ id: string }> };

function parseDay(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

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

async function validateCoachId(coachId: unknown) {
  const id = String(coachId || '').trim();
  if (!id) return null;
  const coach = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  return coach?.role === 'club_coach' ? coach.id : null;
}

async function clubDetail(id: string) {
  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      sessions: { orderBy: { date: 'asc' } },
      participants: { orderBy: { addedAt: 'asc' } },
      _count: { select: { sessions: true, participants: true } },
    },
  });
  if (!club) return null;

  const students = await prisma.student.findMany({
    where: { id: { in: club.participants.map((participant) => participant.studentId) } },
    include: { class: true },
  });
  const studentById = new Map(students.map((student) => [student.id, student]));

  return {
    ...club,
    participants: club.participants.map((participant) => {
      const student = studentById.get(participant.studentId);
      return {
        ...participant,
        student: student
          ? { id: student.id, firstName: student.firstName, lastName: student.lastName, middleName: student.middleName, fio: fio(student), className: className(student.class) }
          : null,
      };
    }),
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...READ_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const access = await findClubForUser(id, auth.session.user.role, auth.session.user.id, auth.session.user.branchId);
    if (access.status === 'not_found') return errorResponse('NOT_FOUND', 'Кружок не найден', 404);
    if (access.status === 'forbidden') return errorResponse('FORBIDDEN', 'Forbidden', 403);

    return successResponse(await clubDetail(id));
  } catch (error) {
    console.error('GET /api/v1/clubs/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить кружок', 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const access = await findClubForUser(id, auth.session.user.role, auth.session.user.id, auth.session.user.branchId);
    if (access.status === 'not_found') return errorResponse('NOT_FOUND', 'Кружок не найден', 404);
    if (access.status === 'forbidden') return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const data: Prisma.ClubUpdateInput = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) return errorResponse('VALIDATION_ERROR', 'Название обязательно');
      data.name = name;
    }
    if (body.subjectId !== undefined) data.subjectId = body.subjectId || null;
    if (body.coachId !== undefined) {
      if (!roleMatches(['super_admin', 'zavuch'], auth.session.user.role)) {
        return errorResponse('FORBIDDEN', 'Forbidden', 403);
      }
      const coachId = await validateCoachId(body.coachId);
      if (!coachId) return errorResponse('VALIDATION_ERROR', 'coachId must be an existing club_coach', 400);
      data.coachId = coachId;
    }
    if (body.status !== undefined && STATUSES.has(body.status)) data.status = body.status;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) await tx.club.update({ where: { id }, data });
      if (Array.isArray(body.days)) {
        const days: Date[] = body.days.map(parseDay).filter((date: Date | null): date is Date => Boolean(date));
        if (days.length > 0) {
          const dedupedDays = [...new Map<string, Date>(days.map((date) => [date.toISOString().slice(0, 10), date])).values()];
          await tx.clubSession.createMany({
            data: dedupedDays.map((date) => ({ clubId: id, date })),
            skipDuplicates: true,
          });
        }
      }
    });

    return successResponse(await clubDetail(id));
  } catch (error) {
    console.error('PATCH /api/v1/clubs/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить кружок', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const access = await findClubForUser(id, auth.session.user.role, auth.session.user.id, auth.session.user.branchId);
    if (access.status === 'not_found') return errorResponse('NOT_FOUND', 'Not found', 404);
    if (access.status === 'forbidden') return errorResponse('FORBIDDEN', 'Forbidden', 403);

    await prisma.$transaction(async (tx) => {
      await tx.achievement.deleteMany({ where: { clubId: id } });
      await tx.club.delete({ where: { id } });
    });
    return successResponse({ id });
  } catch (error) {
    console.error('DELETE /api/v1/clubs/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить кружок', 500);
  }
}
