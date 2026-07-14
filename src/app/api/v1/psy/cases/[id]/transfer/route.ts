import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, CASE_OWNER_ROLES, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);

  const body = await request.json().catch(() => ({}));
  const newOwnerId = typeof body.newOwnerId === 'string' ? body.newOwnerId : '';
  if (!newOwnerId) return errorResponse('VALIDATION_ERROR', 'newOwnerId is required');

  try {
    const c = await prisma.psyCase.findUnique({ where: { id }, select: { id: true, ownerId: true } });
    if (!c || (c.ownerId !== auth.session.user.id && !scope.full)) return errorResponse('FORBIDDEN', 'No permission to transfer this case', 403);
    if (newOwnerId === c.ownerId) return errorResponse('VALIDATION_ERROR', 'Case already has this owner');

    const newOwner = await prisma.user.findUnique({ where: { id: newOwnerId }, select: { id: true, role: true } });
    if (!newOwner || !CASE_OWNER_ROLES.includes(newOwner.role)) {
      return errorResponse('VALIDATION_ERROR', 'New owner cannot own psy cases');
    }

    await prisma.$transaction([
      prisma.psyCase.update({ where: { id }, data: { ownerId: newOwnerId } }),
      prisma.psyCaseCollaborator.deleteMany({ where: { caseId: id, userId: newOwnerId } }),
    ]);

    return successResponse({ id, ownerId: newOwnerId });
  } catch (e) {
    console.error('POST psy/cases/[id]/transfer error:', e);
    return errorResponse('INTERNAL_ERROR', 'Failed to transfer case', 500);
  }
}
