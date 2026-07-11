import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'lostFoundItem',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'student', 'parent', 'zavhoz'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'zavhoz'],
  createFields: ['title', 'description', 'location', 'status'],
  injectUserId: 'authorId',
  orderBy: { foundAt: 'desc' },
  filterableParams: ['status'],
});
