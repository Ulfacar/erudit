import { createCrud } from '@/shared/lib/crud';

// Каталог библиотеки. Выдача/возврат — отдельным шагом (поле available).
export const { GET, POST, DELETE } = createCrud({
  model: 'libraryItem',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'librarian'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'librarian'],
  createFields: ['title', 'author', 'isbn', 'category', 'total', 'available'],
  intFields: ['total', 'available'],
  orderBy: { title: 'asc' },
  filterableParams: ['category'],
});
