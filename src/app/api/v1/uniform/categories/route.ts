import { createCrud } from '@/shared/lib/crud';

const crud = createCrud({
  model: 'uniformCategory',
  listRoles: ['uniform_manager', 'super_admin'],
  writeRoles: ['uniform_manager', 'super_admin'],
  createFields: ['name'],
  branchScope: 'own',
  orderBy: { name: 'asc' },
});

export const GET = crud.GET;
export const POST = crud.POST;
export const DELETE = crud.DELETE;
