import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

/** POST /api/v1/psy/ips/[id]/approve — утвердить ИПС. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);

  try {
    const ips = await prisma.psyIps.findUnique({ where: { id }, include: { case: true } });
    if (!ips) return errorResponse('NOT_FOUND', 'ИПС не найден', 404);
    if (!(await canAccessCase(scope, ips.caseId))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.psyIps.updateMany({
        where: { caseId: ips.caseId, status: 'approved', NOT: { id } },
        data: { status: 'superseded' },
      });

      return tx.psyIps.update({
        where: { id },
        data: { status: 'approved', approvedAt: new Date(), approvedBy: auth.session.user.id },
      });
    });

    return successResponse(updated);
  } catch (e) {
    console.error('POST psy/ips/[id]/approve error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось утвердить ИПС', 500);
  }
}
