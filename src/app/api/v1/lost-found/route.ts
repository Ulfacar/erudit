import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'lostFoundItem',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'],
  createFields: ['title', 'description', 'location', 'status'],
  injectUserId: 'authorId',
  orderBy: { foundAt: 'desc' },
  filterableParams: ['status'],
});
