import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'expense',
  writeRoles: ['super_admin', 'analyst', 'zavuch'],
  createFields: ['category', 'title', 'amount', 'date'],
  dateFields: ['date'],
  intFields: ['amount'],
  injectUserId: 'authorId',
  orderBy: { date: 'desc' },
  filterableParams: ['category'],
});
