import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'assetDistribution',
  createFields: ['assetId', 'assetName', 'category', 'quantity', 'amount', 'destination', 'note'],
  intFields: ['quantity', 'amount'],
  injectUserId: 'authorId',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'zavhoz'],
  listRoles: ['super_admin', 'analyst', 'zavuch', 'zavhoz', 'accountant', 'chief_accountant', 'finance_manager'],
  orderBy: { createdAt: 'desc' },
});
