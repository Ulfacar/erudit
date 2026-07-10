import { createCrudId } from '@/shared/lib/crud';
import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const ROLES = ['uniform_manager', 'super_admin'] as const;

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;

    const { id } = await ctx.params;
    const row = await prisma.uniformItem.findUnique({ where: { id } });
    if (!row) return errorResponse('NOT_FOUND', 'Запись не найдена', 404);

    return successResponse(row);
  } catch (error) {
    console.error('GET /api/v1/uniform/items/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Ошибка', 500);
  }
}

export const { PUT, DELETE } = createCrudId({
  model: 'uniformItem',
  writeRoles: ['uniform_manager', 'super_admin'],
});
