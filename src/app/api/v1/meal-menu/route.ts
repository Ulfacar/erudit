import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'mealMenu',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
  createFields: ['date', 'meal', 'dish', 'calories', 'cost'],
  dateFields: ['date'],
  intFields: ['calories', 'cost'],
  orderBy: { date: 'desc' },
  filterableParams: ['meal'],
});
