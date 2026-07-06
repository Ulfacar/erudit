import { createCrudId } from '@/shared/lib/crud';
import { CC_ROLES } from '@/modules/cc/roles';

const handlers = createCrudId({
  model: 'ccMeeting',
  writeRoles: [...CC_ROLES],
});

export const DELETE = handlers.DELETE;

