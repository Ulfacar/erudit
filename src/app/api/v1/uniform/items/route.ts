import { createCrud } from '@/shared/lib/crud';
import { type NextRequest } from 'next/server';
import { errorResponse } from '@/shared/lib/api-response';

const handlers = createCrud({
  model: 'uniformItem',
  listRoles: ['uniform_manager', 'super_admin'],
  writeRoles: ['uniform_manager', 'super_admin'],
  createFields: ['name', 'category', 'categoryId', 'basic', 'price'],
  intFields: ['price'],
  orderBy: { createdAt: 'desc' },
  filterableParams: ['category'],
});

export const { GET, DELETE } = handlers;

export async function POST(request: NextRequest) {
  try {
    const body = await request.clone().json();
    const price = Number(body.price);

    if (body.price === undefined || body.price === null || body.price === '' || !Number.isInteger(price) || price < 0) {
      return errorResponse('VALIDATION_ERROR', 'Цена должна быть неотрицательным целым числом');
    }

    return handlers.POST(request);
  } catch (error) {
    console.error('POST uniformItem error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать запись', 500);
  }
}
