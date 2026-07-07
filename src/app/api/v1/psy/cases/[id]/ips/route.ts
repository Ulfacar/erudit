import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

/** GET /api/v1/psy/cases/[id]/ips — список ИПС кейса. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, id))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  try {
    const items = await prisma.psyIps.findMany({ where: { caseId: id }, orderBy: { version: 'desc' } });
    return successResponse(items);
  } catch (e) {
    console.error('GET psy/cases/[id]/ips error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить ИПС', 500);
  }
}

/** POST /api/v1/psy/cases/[id]/ips — создать черновик ИПС. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, id))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  const body = await request.json().catch(() => ({}));

  try {
    const latest = await prisma.psyIps.findFirst({
      where: { caseId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const created = await prisma.psyIps.create({
      data: {
        caseId: id,
        version: (latest?.version ?? 0) + 1,
        parentIpsId: typeof body.parentIpsId === 'string' && body.parentIpsId ? body.parentIpsId : null,
        status: 'draft',
        createdBy: auth.session.user.id,
      },
    });

    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/cases/[id]/ips error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать ИПС', 500);
  }
}
