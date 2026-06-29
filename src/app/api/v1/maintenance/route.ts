import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'maintenanceRequest',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'zavhoz'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'zavhoz'],
  createFields: ['title', 'description', 'location', 'priority', 'status', 'assigneeName'],
  injectUserId: 'authorId',
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status', 'priority'],
});
