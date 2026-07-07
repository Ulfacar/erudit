import { type NextRequest } from 'next/server';
import { createCrudId } from '@/shared/lib/crud';
import { errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { prisma } from '@/shared/lib/prisma';
import { canAccessCcProfileBranch } from '@/modules/cc/server-branch-access';
import { CC_ROLES } from '@/modules/cc/roles';
import { closeRecommendationTask } from '@/modules/cc/recommendation';

const handlers = createCrudId({
  model: 'ccDocument',
  writeRoles: [...CC_ROLES],
});

async function guardBranch(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...CC_ROLES] });
  if (auth.response) return { response: auth.response };

  const { id } = await ctx.params;
  const document = await prisma.ccDocument.findUnique({
    where: { id },
    select: { profile: { select: { branchId: true } } },
  });
  if (!document) return { response: errorResponse('NOT_FOUND', 'Запись не найдена', 404) };
  if (!(await canAccessCcProfileBranch(auth.session.user, document.profile.branchId))) {
    return { response: errorResponse('FORBIDDEN', 'Forbidden', 403) };
  }
  return { auth };
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestForCrud = request.clone() as NextRequest;
  const body = await request.json().catch(() => ({}));
  const guard = await guardBranch(request, ctx);
  if (guard.response) return guard.response;
  const response = await handlers.PUT(requestForCrud, ctx);
  if (response.ok && body?.status === 'received') {
    const { id } = await ctx.params;
    const document = await prisma.ccDocument.findUnique({
      where: { id },
      select: { docType: true, status: true },
    });
    if (document?.docType === 'recommendation' && document.status === 'received') {
      await closeRecommendationTask(id, guard.auth.session.user.id);
    }
  }
  return response;
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardBranch(request, ctx);
  if (guard.response) return guard.response;
  return handlers.DELETE(request, ctx);
}
