import { type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { branchWhere, getBranchScope } from '@/shared/lib/branch-scope';

const READ_ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;
const WRITE_ROLES = ['olympiad_coach', 'super_admin', 'zavuch'] as const;
const STATUSES = new Set(['planned', 'ongoing', 'finished']);

function parseDay(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function uniqueDays(values: unknown) {
  if (!Array.isArray(values)) return [];
  const byIso = new Map<string, Date>();
  for (const value of values) {
    const date = parseDay(value);
    if (date) byIso.set(date.toISOString().slice(0, 10), date);
  }
  return [...byIso.values()].sort((a, b) => a.getTime() - b.getTime());
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...READ_ROLES] });
    if (auth.response) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const where: Prisma.IntensiveWhereInput = {};
    const olympiadId = searchParams.get('olympiadId');
    const status = searchParams.get('status');
    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);

    if (olympiadId) where.olympiadId = olympiadId;
    if (status) where.status = status;
    Object.assign(where, branchWhere(scope));

    const intensives = await prisma.intensive.findMany({
      where,
      include: {
        olympiad: { select: { id: true, name: true } },
        _count: { select: { days: true, participants: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    return successResponse(intensives);
  } catch (error) {
    console.error('GET /api/v1/olympiad-center/intensives error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить интенсивы', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const name = String(body.name || '').trim();
    const startDate = parseDate(body.startDate);
    const endDate = parseDate(body.endDate);
    const days = uniqueDays(body.days);

    if (!name) return errorResponse('VALIDATION_ERROR', 'Название обязательно');
    if (!startDate || !endDate) return errorResponse('VALIDATION_ERROR', 'Укажите период интенсива');
    if (startDate.getTime() > endDate.getTime()) return errorResponse('VALIDATION_ERROR', 'Дата начала не может быть позже даты окончания');
    if (days.length < 1) return errorResponse('VALIDATION_ERROR', 'Выберите хотя бы один день интенсива');

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    if (scope.closed) return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const created = await prisma.$transaction(async (tx) => {
      const intensive = await tx.intensive.create({
        data: {
          name,
          subjectId: body.subjectId || null,
          olympiadId: body.olympiadId || null,
          startDate,
          endDate,
          status: STATUSES.has(body.status) ? body.status : 'planned',
          coachId: auth.session.user.id,
          branchId: scope.branchId,
        },
      });

      await tx.intensiveDay.createMany({
        data: days.map((date) => ({ intensiveId: intensive.id, date })),
        skipDuplicates: true,
      });

      return tx.intensive.findUnique({
        where: { id: intensive.id },
        include: {
          olympiad: { select: { id: true, name: true } },
          days: { orderBy: { date: 'asc' } },
          _count: { select: { days: true, participants: true } },
        },
      });
    });

    return successResponse(created, 201);
  } catch (error) {
    console.error('POST /api/v1/olympiad-center/intensives error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать интенсив', 500);
  }
}
