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

async function findIpsForAccess(ipsId: string) {
  return prisma.psyIps.findUnique({
    where: { id: ipsId },
    select: { id: true, caseId: true },
  });
}

/** GET /api/v1/psy/ips/[id]/goals - список SMART-целей ИПС. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);

  try {
    const ips = await findIpsForAccess(id);
    if (!ips) return errorResponse('NOT_FOUND', 'ИПС не найден', 404);
    if (!(await canAccessCase(scope, ips.caseId))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

    const goals = await prisma.psyIpsGoal.findMany({
      where: { ipsId: ips.id },
      orderBy: { id: 'asc' },
    });

    return successResponse(goals);
  } catch (e) {
    console.error('GET psy/ips/[id]/goals error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить цели ИПС', 500);
  }
}

/** POST /api/v1/psy/ips/[id]/goals - создать SMART-цель ИПС. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);

  try {
    const ips = await findIpsForAccess(id);
    if (!ips) return errorResponse('NOT_FOUND', 'ИПС не найден', 404);
    if (!(await canAccessCase(scope, ips.caseId))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

    const body = await request.json().catch(() => ({}));
    const specific = typeof body.specific === 'string' ? body.specific.trim() : '';
    if (!specific) return errorResponse('VALIDATION_ERROR', 'Нужна конкретная цель (Specific)');

    if (typeof body.deadline !== 'string' || !DEADLINES.includes(body.deadline as (typeof DEADLINES)[number])) {
      return errorResponse('VALIDATION_ERROR', 'Некорректный срок SMART-цели');
    }

    const directions = normalizeDirections(body.directions);
    if (!directions) return errorResponse('VALIDATION_ERROR', 'Нужно 1–3 направления');

    const created = await prisma.psyIpsGoal.create({
      data: {
        ipsId: ips.id,
        specific,
        measurable: normalizeOptionalText(body.measurable),
        achievable: normalizeOptionalText(body.achievable),
        relevant: normalizeOptionalText(body.relevant),
        timeBound: normalizeOptionalText(body.timeBound),
        deadline: body.deadline,
        directions: directions as Prisma.InputJsonValue,
      },
    });

    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/ips/[id]/goals error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать цель ИПС', 500);
  }
}
