import { createCrud } from '@/shared/lib/crud';
import { CC_ROLES } from '@/modules/cc/roles';

export const { GET, POST, DELETE } = createCrud({
  model: 'ccMeeting',
  listRoles: [...CC_ROLES],
  writeRoles: [...CC_ROLES],
  createFields: ['meetingDate', 'topic', 'notes', 'actionItems', 'format', 'profileId'],
  dateFields: ['meetingDate'],
  injectUserId: 'counselorId',
  filterableParams: ['profileId'],
  branchScope: 'profile',
  orderBy: { meetingDate: 'desc' },
});
