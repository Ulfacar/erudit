import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'specialistProgress',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator', 'psychologist', 'senior_psychologist'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator', 'psychologist', 'doctor'],
  createFields: ['kind', 'studentId', 'metric', 'value', 'note', 'date'],
  dateFields: ['date'],
  intFields: ['value'],
  injectUserId: 'specialistId',
  orderBy: { date: 'desc' },
  filterableParams: ['kind', 'studentId'],
});
