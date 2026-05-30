import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'maintenanceRequest',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
  createFields: ['title', 'description', 'location', 'priority', 'status', 'assigneeName'],
  injectUserId: 'authorId',
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status', 'priority'],
});
