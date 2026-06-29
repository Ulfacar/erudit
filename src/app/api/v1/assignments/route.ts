import { createCrud } from '@/shared/lib/crud';

/**
 * Назначения журнала (EduPage-style): колонки с очками.
 * Оценки привязываются к назначению через Grade.assignmentId.
 */
export const { GET, POST, DELETE } = createCrud({
  model: 'assignment',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'],
  writeRoles: ['teacher', 'curator', 'zavuch', 'super_admin'],
  createFields: ['title', 'shortName', 'classId', 'subjectId', 'teacherId', 'periodId', 'categoryId', 'maxPoints', 'date'],
  intFields: ['maxPoints'],
  dateFields: ['date'],
  orderBy: { date: 'asc' },
  filterableParams: ['classId', 'subjectId', 'periodId'],
});
