import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'asset',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
  createFields: ['name', 'inventoryNo', 'location', 'category', 'quantity', 'condition'],
  intFields: ['quantity'],
  orderBy: { name: 'asc' },
  filterableParams: ['category'],
});
