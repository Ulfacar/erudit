import { createCrud } from '@/shared/lib/crud';

const handlers = createCrud({
  model: 'tariffLead',
  listRoles: ['super_admin', 'founder', 'analyst'],
  writeRoles: ['super_admin', 'founder', 'analyst'],
  createFields: [
    'contactName',
    'contactPhone',
    'contactSchool',
    'comment',
    'standardModules',
    'heavyModules',
    'setupTotal',
    'licenseTotal',
  ],
  intFields: ['setupTotal', 'licenseTotal'],
  injectUserId: 'authorId',
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status'],
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
