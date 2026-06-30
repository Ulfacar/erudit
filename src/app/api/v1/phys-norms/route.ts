import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'physNorm',
  createFields: ['studentId', 'exercise', 'result', 'grade', 'date'],
  dateFields: ['date'],
  injectUserId: 'teacherId',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'],
  listRoles: ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'],
  orderBy: { date: 'desc' },
  filterableParams: ['studentId'],
});
