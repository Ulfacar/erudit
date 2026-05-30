import { createCrud } from '@/shared/lib/crud';

// Каталог библиотеки. Выдача/возврат — отдельным шагом (поле available).
export const { GET, POST, DELETE } = createCrud({
  model: 'libraryItem',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
  createFields: ['title', 'author', 'isbn', 'category', 'total', 'available'],
  intFields: ['total', 'available'],
  orderBy: { title: 'asc' },
  filterableParams: ['category'],
});
