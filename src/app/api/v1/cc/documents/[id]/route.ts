import { type NextRequest } from 'next/server';
import { createCrudId } from '@/shared/lib/crud';
import { errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { prisma } from '@/shared/lib/prisma';
import { canAccessCcProfileBranch } from '@/modules/cc/server-branch-access';
import { CC_ROLES } from '@/modules/cc/roles';

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
  return {};
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardBranch(request, ctx);
  if (guard.response) return guard.response;
  return handlers.PUT(request, ctx);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardBranch(request, ctx);
  if (guard.response) return guard.response;
  return handlers.DELETE(request, ctx);
}
