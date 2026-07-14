import { createCrud } from '@/shared/lib/crud';
import { CC_ROLES } from '@/modules/cc/roles';

const crud = createCrud({
  model: 'ccUniversity',
  listRoles: [...CC_ROLES],
  writeRoles: [...CC_ROLES],
  createFields: ['name', 'country', 'program', 'costUsd', 'requiredGpa', 'requiredDocuments', 'requirementsNote'],
  intFields: ['costUsd'],
  branchScope: 'own',
  orderBy: { name: 'asc' },
});

export const GET = crud.GET;
export const POST = crud.POST;
export const DELETE = crud.DELETE;
