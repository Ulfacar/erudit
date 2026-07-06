import { createCrud } from '@/shared/lib/crud';
import { CC_ROLES } from '@/modules/cc/roles';

export const { GET, POST, DELETE } = createCrud({
  model: 'ccApplication',
  listRoles: [...CC_ROLES],
  writeRoles: [...CC_ROLES],
  createFields: ['universityName', 'country', 'program', 'applicationType', 'deadlineDate', 'comment', 'profileId'],
  dateFields: ['deadlineDate'],
  filterableParams: ['profileId', 'admissionStatus'],
  branchScope: 'profile',
  orderBy: { deadlineDate: 'asc' },
});
