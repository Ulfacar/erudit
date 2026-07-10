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
    const rows = await prisma.uniformVariant.findMany({
      where: { itemId: id },
      select: { id: true, itemId: true, size: true, total: true, available: true },
      orderBy: { size: 'asc' },
    });

    return successResponse(rows);
  } catch (error) {
    console.error('GET /api/v1/uniform/items/[id]/variants error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить размеры', 500);
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;

    const { id } = await ctx.params;
    const body = await request.json();
    const size = String(body.size ?? '').trim();
    const quantity = Number(body.quantity);

    if (!size || !Number.isInteger(quantity) || quantity <= 0) {
      return errorResponse('VALIDATION_ERROR', 'Укажите размер и положительное количество');
    }

    const item = await prisma.uniformItem.findUnique({ where: { id }, select: { id: true } });
    if (!item) return errorResponse('NOT_FOUND', 'Товар не найден', 404);

    const variant = await prisma.uniformVariant.upsert({
      where: { itemId_size: { itemId: id, size } },
      update: {
        total: { increment: quantity },
        available: { increment: quantity },
      },
      create: {
        itemId: id,
        size,
        total: quantity,
        available: quantity,
      },
    });

    return successResponse(variant, 201);
  } catch (error) {
    console.error('POST /api/v1/uniform/items/[id]/variants error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось принять товар', 500);
  }
}
