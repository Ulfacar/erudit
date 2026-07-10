import { createCrudId } from '@/shared/lib/crud';

export const { PUT, DELETE } = createCrudId({
  model: 'moduleGrant',
  writeRoles: ['super_admin'],
});
