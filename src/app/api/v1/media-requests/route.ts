import { createCrud } from '@/shared/lib/crud';

const MEDIA_ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'event_manager', 'media'] as const;

export const { GET, POST, DELETE } = createCrud({
  model: 'mediaRequest',
  createFields: ['title', 'description', 'location', 'date', 'priority', 'source', 'eventId'],
  dateFields: ['date'],
  injectUserId: 'requesterId',
  writeRoles: [...MEDIA_ROLES],
  listRoles: [...MEDIA_ROLES],
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status', 'priority', 'source'],
});
