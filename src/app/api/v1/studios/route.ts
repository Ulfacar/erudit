import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'studio',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'specialist', 'student', 'parent'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'curator'],
  createFields: ['name', 'description', 'leaderName', 'schedule', 'capacity'],
  intFields: ['capacity'],
  orderBy: { name: 'asc' },
});
