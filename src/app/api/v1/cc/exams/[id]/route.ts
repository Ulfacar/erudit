import { createCrudId } from '@/shared/lib/crud';
import { CC_ROLES } from '@/modules/cc/roles';

const handlers = createCrudId({
  model: 'ccExam',
  writeRoles: [...CC_ROLES],
});

export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
