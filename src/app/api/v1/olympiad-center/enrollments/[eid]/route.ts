import { type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getBranchScope, type BranchScope } from '@/shared/lib/branch-scope';

const WRITE_ROLES = ['olympiad_coach', 'super_admin', 'zavuch'] as const;
const STATUSES = new Set(['enrolled', 'participated', 'no_show']);

type RouteParams = { params: Promise<{ eid: string }> };

function canAccessBranch(branchId: string | null, scope: BranchScope) {
  if (scope.closed) return false;
  if (scope.branchId) return branchId === scope.branchId;
  return scope.canSeeAll;
}

function awardValues(values: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(values)) return new Set<string>();
  return new Set(
    values
      .filter((item): item is Record<string, Prisma.JsonValue> => !!item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => String(item.value)),
  );
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;

    const { eid } = await params;
    const body = await request.json();
    const enrollment = await prisma.olympiadParticipation.findUnique({
      where: { id: eid },
      select: {
        id: true,
        studentId: true,
        status: true,
        olympiad: { select: { awardScheme: { select: { values: true } } } },
      },
    });
    if (!enrollment) return errorResponse('NOT_FOUND', 'Not found', 404);

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role, auth.session.user.branchId);
    const student = await prisma.student.findUnique({ where: { id: enrollment.studentId }, select: { branchId: true } });
    if (!student || !canAccessBranch(student.branchId, scope)) return errorResponse('NOT_FOUND', 'Not found', 404);

    const data: {
      status?: string;
      awardValue?: string | null;
      score?: number | null;
      comment?: string | null;
    } = {};

    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !STATUSES.has(body.status)) {
        return errorResponse('VALIDATION_ERROR', 'Invalid status');
      }
      data.status = body.status;
    }

    const finalStatus = data.status ?? enrollment.status ?? 'enrolled';
    const hasAward = body.awardValue !== undefined;
    const awardValue = typeof body.awardValue === 'string' && body.awardValue.trim() ? body.awardValue.trim() : null;

    if (hasAward && awardValue && finalStatus !== 'participated') {
      return errorResponse('VALIDATION_ERROR', 'Award requires participated status');
    }
    if (hasAward && awardValue) {
      const allowedAwards = awardValues(enrollment.olympiad.awardScheme?.values);
      if (!allowedAwards.has(awardValue)) return errorResponse('VALIDATION_ERROR', 'Invalid award value');
      data.awardValue = awardValue;
    } else if (hasAward) {
      data.awardValue = null;
    }

    if (finalStatus !== 'participated') data.awardValue = null;

    if (body.score !== undefined) {
      if (body.score === null || body.score === '') {
        data.score = null;
      } else {
        const score = Number(body.score);
        if (!Number.isFinite(score)) return errorResponse('VALIDATION_ERROR', 'Invalid score');
        data.score = score;
      }
    }

    if (body.comment !== undefined) {
      if (body.comment === null) data.comment = null;
      else if (typeof body.comment === 'string') data.comment = body.comment;
      else return errorResponse('VALIDATION_ERROR', 'Invalid comment');
    }

    const updated = await prisma.olympiadParticipation.update({ where: { id: eid }, data });
    return successResponse(updated);
  } catch (error) {
    console.error('PATCH /api/v1/olympiad-center/enrollments/[eid] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to save result', 500);
  }
}
