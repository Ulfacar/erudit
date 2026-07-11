import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'specialistSession',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator', 'psychologist', 'senior_psychologist', 'doctor'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'secretary', 'curator', 'psychologist', 'doctor'],
  createFields: ['kind', 'studentId', 'date', 'startTime', 'endTime', 'groupName', 'note'],
  dateFields: ['date'],
  injectUserId: 'specialistId',
  orderBy: { date: 'desc' },
  filterableParams: ['kind', 'studentId'],
});
