import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'purchaseRequest',
  listRoles: ['super_admin', 'analyst', 'finance_manager', 'accountant', 'chief_accountant', 'zavhoz', 'zavuch'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'zavhoz'],
  createFields: ['title', 'items', 'amount'],
  intFields: ['amount'],
  injectUserId: 'authorId',
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status'],
});
