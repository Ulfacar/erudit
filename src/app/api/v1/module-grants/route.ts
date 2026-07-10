import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'moduleGrant',
  listRoles: ['super_admin'],
  writeRoles: ['super_admin'],
  createFields: ['userId', 'module', 'canRead', 'canWrite', 'canApprove'],
  injectUserId: 'grantedById',
  filterableParams: ['userId'],
  orderBy: { createdAt: 'desc' },
});
