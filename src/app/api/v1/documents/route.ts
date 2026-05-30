import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'documentRecord',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
  createFields: ['ownerType', 'ownerId', 'kind', 'title', 'number', 'issuedAt', 'expiresAt', 'fileUrl', 'fileName'],
  dateFields: ['issuedAt', 'expiresAt'],
  injectUserId: 'authorId',
  orderBy: { createdAt: 'desc' },
  filterableParams: ['ownerType', 'ownerId'],
});
