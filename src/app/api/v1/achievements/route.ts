import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'achievement',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'],
  createFields: ['studentId', 'title', 'description', 'category', 'level', 'place', 'date'],
  dateFields: ['date'],
  injectUserId: 'authorId',
  orderBy: { date: 'desc' },
  filterableParams: ['studentId', 'category', 'level'],
});
