import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'candidate',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'hr', 'chief_accountant'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'hr', 'chief_accountant'],
  createFields: ['fullName', 'phone', 'email', 'position', 'status', 'note', 'vacancyId'],
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status', 'position'],
  branchScope: 'own',
});
