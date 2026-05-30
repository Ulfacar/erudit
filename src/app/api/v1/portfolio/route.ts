import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'portfolioEntry',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'],
  createFields: ['studentId', 'type', 'title', 'description', 'fileUrl', 'fileName', 'date'],
  dateFields: ['date'],
  injectUserId: 'authorId',
  orderBy: { date: 'desc' },
  filterableParams: ['studentId', 'type'],
});
