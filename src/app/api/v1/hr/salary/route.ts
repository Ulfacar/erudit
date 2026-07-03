import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'salaryRecord',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'hr', 'accountant', 'chief_accountant'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'hr', 'accountant', 'chief_accountant'],
  createFields: ['staffId', 'period', 'amount', 'bonus', 'paid'],
  intFields: ['amount', 'bonus'],
  orderBy: { createdAt: 'desc' },
  filterableParams: ['staffId', 'period'],
  branchScope: 'own',
});
