import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'schoolEvent',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'],
  createFields: ['title', 'description', 'date', 'endDate', 'location', 'audience'],
  dateFields: ['date', 'endDate'],
  injectUserId: 'organizerId',
  orderBy: { date: 'asc' },
});
