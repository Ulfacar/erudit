import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'specialistRecommendation',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator'],
  createFields: ['kind', 'studentId', 'text', 'date'],
  dateFields: ['date'],
  injectUserId: 'specialistId',
  orderBy: { date: 'desc' },
  filterableParams: ['kind', 'studentId'],
});
