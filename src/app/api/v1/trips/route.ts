import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'trip',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary', 'curator'],
  createFields: ['title', 'description', 'destination', 'date', 'returnDate', 'classId', 'cost'],
  dateFields: ['date', 'returnDate'],
  intFields: ['cost'],
  injectUserId: 'responsibleId',
  orderBy: { date: 'desc' },
});
