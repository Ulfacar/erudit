import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'expense',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'],
  createFields: ['category', 'title', 'amount', 'date'],
  dateFields: ['date'],
  intFields: ['amount'],
  injectUserId: 'authorId',
  orderBy: { date: 'desc' },
  filterableParams: ['category'],
  branchScope: 'own',
});
