import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'specialistProgress',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator'],
  createFields: ['kind', 'studentId', 'metric', 'value', 'note', 'date'],
  dateFields: ['date'],
  intFields: ['value'],
  injectUserId: 'specialistId',
  orderBy: { date: 'desc' },
  filterableParams: ['kind', 'studentId'],
});
