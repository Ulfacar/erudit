import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'asset',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'zavhoz'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'zavhoz'],
  createFields: ['name', 'inventoryNo', 'location', 'category', 'quantity', 'condition'],
  intFields: ['quantity'],
  orderBy: { name: 'asc' },
  filterableParams: ['category'],
});
