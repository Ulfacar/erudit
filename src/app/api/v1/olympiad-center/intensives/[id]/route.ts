import { type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, type BranchScope } from '@/shared/lib/branch-scope';

const READ_ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;
const WRITE_ROLES = ['olympiad_coach', 'super_admin', 'zavuch'] as const;
const STATUSES = new Set(['planned', 'ongoing', 'finished']);

type RouteParams = { params: Promise<{ id: string }> };

function parseDay(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !value) return undefined;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

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

async function intensiveDetail(id: string) {
  const intensive = await prisma.intensive.findUnique({
    where: { id },
    include: {
      olympiad: { select: { id: true, name: true } },
      days: { orderBy: { date: 'asc' } },
      participants: { orderBy: { addedAt: 'asc' } },
      _count: { select: { days: true, participants: true } },
    },
  });
  if (!intensive) return null;

  const students = await prisma.student.findMany({
    where: { id: { in: intensive.participants.map((participant) => participant.studentId) } },
    include: { class: true },
  });
  const studentById = new Map(students.map((student) => [student.id, student]));

  return {
    ...intensive,
    participants: intensive.participants.map((participant) => {
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
    const intensive = await intensiveDetail(id);
    if (!intensive) return errorResponse('NOT_FOUND', 'Интенсив не найден', 404);

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    if (!canAccessBranch(intensive.branchId, scope)) return errorResponse('NOT_FOUND', 'Not found', 404);

    return successResponse(intensive);
  } catch (error) {
    console.error('GET /api/v1/olympiad-center/intensives/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить интенсив', 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const data: Prisma.IntensiveUpdateInput = {};
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);

    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) return errorResponse('VALIDATION_ERROR', 'Название обязательно');
      data.name = name;
    }
    if (body.subjectId !== undefined) data.subjectId = body.subjectId || null;
    if (body.olympiadId !== undefined) data.olympiad = body.olympiadId ? { connect: { id: String(body.olympiadId) } } : { disconnect: true };
    if (body.status !== undefined && STATUSES.has(body.status)) data.status = body.status;

    const startDate = parseDate(body.startDate);
    const endDate = parseDate(body.endDate);
    if (startDate) data.startDate = startDate;
    if (endDate) data.endDate = endDate;
    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      return errorResponse('VALIDATION_ERROR', 'Дата начала не может быть позже даты окончания');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.intensive.findUnique({ where: { id }, select: { id: true, startDate: true, endDate: true, branchId: true } });
      if (!existing) return null;
      if (!canAccessBranch(existing.branchId, scope)) return null;

      const nextStart = startDate ?? existing.startDate;
      const nextEnd = endDate ?? existing.endDate;
      if (nextStart.getTime() > nextEnd.getTime()) throw new Error('INVALID_PERIOD');

      await tx.intensive.update({ where: { id }, data });

      if (Array.isArray(body.days)) {
        const days: Date[] = body.days.map(parseDay).filter((date: Date | null): date is Date => Boolean(date));
        if (days.length > 0) {
          const dedupedDays = [...new Map<string, Date>(days.map((date) => [date.toISOString().slice(0, 10), date])).values()];
          await tx.intensiveDay.createMany({
            data: dedupedDays.map((date) => ({ intensiveId: id, date })),
            skipDuplicates: true,
          });
        }
      }

      return id;
    });

    if (!updated) return errorResponse('NOT_FOUND', 'Интенсив не найден', 404);
    return successResponse(await intensiveDetail(id));
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PERIOD') {
      return errorResponse('VALIDATION_ERROR', 'Дата начала не может быть позже даты окончания');
    }
    console.error('PATCH /api/v1/olympiad-center/intensives/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить интенсив', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { id } = await params;
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const intensive = await prisma.intensive.findUnique({ where: { id }, select: { id: true, branchId: true } });
    if (!intensive || !canAccessBranch(intensive.branchId, scope)) {
      return errorResponse('NOT_FOUND', 'Not found', 404);
    }

    await prisma.intensive.delete({ where: { id } });
    return successResponse({ id });
  } catch (error) {
    console.error('DELETE /api/v1/olympiad-center/intensives/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить интенсив', 500);
  }
}
