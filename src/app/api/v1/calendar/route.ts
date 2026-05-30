import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'calendarEvent',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'],
  createFields: ['title', 'description', 'date', 'endDate', 'type', 'classId', 'audience'],
  dateFields: ['date', 'endDate'],
  injectUserId: 'authorId',
  orderBy: { date: 'asc' },
  filterableParams: ['type', 'classId'],
});
