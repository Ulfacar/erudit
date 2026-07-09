import { createCrud } from '@/shared/lib/crud';

export const { GET, POST } = createCrud({
  model: 'awardScheme',
  listRoles: ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'],
  writeRoles: ['olympiad_coach', 'super_admin', 'zavuch'],
  createFields: ['name', 'type', 'values', 'branchId'],
  injectUserId: 'authorId',
  orderBy: { createdAt: 'asc' },
});
