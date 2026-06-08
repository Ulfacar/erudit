import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'staffContract',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'hr'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'hr'],
  createFields: ['staffId', 'number', 'position', 'salary', 'startDate', 'endDate', 'status'],
  intFields: ['salary'],
  dateFields: ['startDate', 'endDate'],
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status', 'staffId'],
});
