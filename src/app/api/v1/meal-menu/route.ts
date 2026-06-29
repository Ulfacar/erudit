import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'mealMenu',
  listRoles: ['student', 'parent', 'super_admin', 'analyst', 'zavuch', 'cook'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'cook'],
  createFields: ['date', 'meal', 'dish', 'calories', 'cost'],
  dateFields: ['date'],
  intFields: ['calories', 'cost'],
  orderBy: { date: 'desc' },
  filterableParams: ['meal'],
});
