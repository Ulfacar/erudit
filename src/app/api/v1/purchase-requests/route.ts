import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'purchaseRequest',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'zavhoz'],
  createFields: ['title', 'items', 'amount'],
  intFields: ['amount'],
  injectUserId: 'authorId',
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status'],
});
