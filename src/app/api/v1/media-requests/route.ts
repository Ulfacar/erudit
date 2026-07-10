import { createCrud } from '@/shared/lib/crud';
import { ALL_ROLES } from '@/shared/constants/roles';
import type { Role } from '@prisma/client';

const MEDIA_ROLES: Role[] = ALL_ROLES.filter((r) => r !== 'student' && r !== 'parent');

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
