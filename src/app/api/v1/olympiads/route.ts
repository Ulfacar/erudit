import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'olympiad',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'specialist', 'student', 'parent'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'],
  createFields: ['name', 'subjectId', 'level', 'stage', 'date'],
  dateFields: ['date'],
  injectUserId: 'authorId',
  orderBy: { date: 'desc' },
  filterableParams: ['level'],
});
