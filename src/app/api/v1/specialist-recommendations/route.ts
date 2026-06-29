import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'specialistRecommendation',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator', 'psychologist', 'senior_psychologist'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'specialist', 'curator', 'psychologist', 'doctor'],
  createFields: ['kind', 'studentId', 'text', 'date'],
  dateFields: ['date'],
  injectUserId: 'specialistId',
  orderBy: { date: 'desc' },
  filterableParams: ['kind', 'studentId'],
});
