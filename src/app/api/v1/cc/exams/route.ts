import { createCrud } from '@/shared/lib/crud';
import { CC_ROLES } from '@/modules/cc/roles';

export const { GET, POST, DELETE } = createCrud({
  model: 'ccExam',
  listRoles: [...CC_ROLES],
  writeRoles: [...CC_ROLES],
  createFields: ['examType', 'testDate', 'scoreCurrent', 'scoreTarget', 'isMock', 'verified', 'certificateUrl', 'comment', 'customExamName', 'profileId'],
  dateFields: ['testDate'],
  intFields: [],
  filterableParams: ['profileId', 'examType'],
  branchScope: 'profile',
  branchParent: { model: 'ccProfile', fk: 'profileId' },
  orderBy: { testDate: 'asc' },
});
