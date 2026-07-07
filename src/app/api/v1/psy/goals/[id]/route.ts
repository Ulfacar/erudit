import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

const DEADLINES = ['2w', '3w', '4w', '3m', '6m'] as const;

function normalizeOptionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeDirections(value: unknown) {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === 'string')) return null;

  const directions = value
    .map((item) => item.trim())
    .filter(Boolean);

  return directions.length >= 1 && directions.length <= 3 ? directions : null;
}

/** PATCH /api/v1/psy/goals/[id] - обновить SMART-цель или отметить достижение. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  const body = await request.json().catch(() => ({}));

  try {
    const goal = await prisma.psyIpsGoal.findUnique({
      where: { id },
      include: { ips: { select: { caseId: true } } },
    });
    if (!goal) return errorResponse('NOT_FOUND', 'Цель ИПС не найдена', 404);
    if (!(await canAccessCase(scope, goal.ips.caseId))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

    const data: Prisma.PsyIpsGoalUpdateInput = {};

    if ('achieved' in body) {
      const achieved = Boolean(body.achieved);
      data.achieved = achieved;
      data.achievedAt = achieved ? new Date() : null;
    }

    if ('specific' in body) {
      const specific = typeof body.specific === 'string' ? body.specific.trim() : '';
      if (!specific) return errorResponse('VALIDATION_ERROR', 'Нужна конкретная цель (Specific)');
      data.specific = specific;
    }

    if ('measurable' in body) data.measurable = normalizeOptionalText(body.measurable);
    if ('achievable' in body) data.achievable = normalizeOptionalText(body.achievable);
    if ('relevant' in body) data.relevant = normalizeOptionalText(body.relevant);
    if ('timeBound' in body) data.timeBound = normalizeOptionalText(body.timeBound);

    if ('deadline' in body) {
      if (typeof body.deadline !== 'string' || !DEADLINES.includes(body.deadline as (typeof DEADLINES)[number])) {
        return errorResponse('VALIDATION_ERROR', 'Некорректный срок SMART-цели');
      }
      data.deadline = body.deadline;
    }

    if ('directions' in body) {
      const directions = normalizeDirections(body.directions);
      if (!directions) return errorResponse('VALIDATION_ERROR', 'Нужно 1–3 направления');
      data.directions = directions as Prisma.InputJsonValue;
    }

    if (Object.keys(data).length === 0) return errorResponse('VALIDATION_ERROR', 'Нет полей для обновления');

    const updated = await prisma.psyIpsGoal.update({
      where: { id },
      data,
    });

    return successResponse(updated);
  } catch (e) {
    console.error('PATCH psy/goals/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить цель ИПС', 500);
  }
}
