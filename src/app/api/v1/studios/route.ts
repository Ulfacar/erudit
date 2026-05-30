import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'studio',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'curator'],
  createFields: ['name', 'description', 'leaderName', 'schedule', 'capacity'],
  intFields: ['capacity'],
  orderBy: { name: 'asc' },
});
