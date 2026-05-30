import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'specialistSession',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'secretary', 'curator'],
  createFields: ['kind', 'studentId', 'date', 'startTime', 'endTime', 'groupName', 'note'],
  dateFields: ['date'],
  injectUserId: 'specialistId',
  orderBy: { date: 'desc' },
  filterableParams: ['kind', 'studentId'],
});
