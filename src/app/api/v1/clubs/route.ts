import { type NextRequest } from 'next/server';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { branchWhere, canAccessBranch, getBranchScope } from '@/shared/lib/branch-scope';
import { roleMatches } from '@/shared/lib/role-access';

const READ_ROLES = ['club_coach', 'super_admin', 'zavuch'] as const;
const WRITE_ROLES = ['club_coach', 'super_admin', 'zavuch'] as const;
const STATUSES = new Set(['active', 'archived']);

function parseDay(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
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

async function resolveCoachId(bodyCoachId: unknown, role: Role, userId: string) {
  if (role === 'club_coach' || bodyCoachId === undefined) return { coachId: userId };
  if (!roleMatches(['super_admin', 'zavuch'], role)) return { coachId: userId };

  const coachId = String(bodyCoachId || '').trim();
  if (!coachId) return { error: true as const };

  const coach = await prisma.user.findUnique({ where: { id: coachId }, select: { id: true, role: true } });
  if (!coach || coach.role !== 'club_coach') return { error: true as const };
  return { coachId: coach.id };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...READ_ROLES] });
    if (auth.response) return auth.response;

    const where: Prisma.ClubWhereInput = {};
    const status = request.nextUrl.searchParams.get('status');
    if (status) where.status = status;
    if (auth.session.user.role === 'club_coach') {
      where.coachId = auth.session.user.id;
    } else {
      const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
      Object.assign(where, branchWhere(scope));
    }

    const clubs = await prisma.club.findMany({
      where,
      include: { _count: { select: { sessions: true, participants: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(clubs);
  } catch (error) {
    console.error('GET /api/v1/clubs error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить кружки', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const name = String(body.name || '').trim();
    const days = uniqueDays(body.days);
    if (!name) return errorResponse('VALIDATION_ERROR', 'Название обязательно');

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    if (scope.closed) return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const coach = await resolveCoachId(body.coachId, auth.session.user.role, auth.session.user.id);
    if ('error' in coach) return errorResponse('VALIDATION_ERROR', 'coachId must be an existing club_coach', 400);

    const created = await prisma.$transaction(async (tx) => {
      const club = await tx.club.create({
        data: {
          name,
          subjectId: body.subjectId || null,
          coachId: coach.coachId,
          branchId: scope.branchId,
          status: STATUSES.has(body.status) ? body.status : 'active',
        },
      });

      if (days.length > 0) {
        await tx.clubSession.createMany({
          data: days.map((date) => ({ clubId: club.id, date })),
          skipDuplicates: true,
        });
      }

      return tx.club.findUnique({
        where: { id: club.id },
        include: {
          sessions: { orderBy: { date: 'asc' } },
          _count: { select: { sessions: true, participants: true } },
        },
      });
    });

    return successResponse(created, 201);
  } catch (error) {
    console.error('POST /api/v1/clubs error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать кружок', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const body = request.headers.get('content-type')?.includes('application/json') ? await request.json().catch(() => ({})) : {};
    const id = String(body.id || request.nextUrl.searchParams.get('id') || '').trim();
    if (!id) return errorResponse('VALIDATION_ERROR', 'id обязателен');

    const club = await prisma.club.findUnique({ where: { id }, select: { id: true, coachId: true, branchId: true } });
    if (!club) return errorResponse('NOT_FOUND', 'Not found', 404);
    if (auth.session.user.role === 'club_coach' && club.coachId !== auth.session.user.id) {
      return errorResponse('FORBIDDEN', 'Forbidden', 403);
    }
    if (auth.session.user.role !== 'club_coach') {
      const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
      if (!canAccessBranch(scope, club.branchId)) return errorResponse('NOT_FOUND', 'Not found', 404);
    }

    await prisma.club.delete({ where: { id } });
    return successResponse({ id });
  } catch (error) {
    console.error('DELETE /api/v1/clubs error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить кружок', 500);
  }
}
