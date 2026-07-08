import { type NextRequest } from 'next/server';
import { createCrud } from '@/shared/lib/crud';
import { CC_ROLES } from '@/modules/cc/roles';
import { validateDeadline } from '@/modules/cc/deadline';
import { errorResponse } from '@/shared/lib/api-response';

const crud = createCrud({
  model: 'ccApplication',
  listRoles: [...CC_ROLES],
  writeRoles: [...CC_ROLES],
  createFields: ['universityName', 'country', 'program', 'applicationType', 'deadlineDate', 'comment', 'requiredGpa', 'requiredDocuments', 'requirementsNote', 'profileId'],
  dateFields: ['deadlineDate'],
  filterableParams: ['profileId', 'admissionStatus'],
  branchScope: 'profile',
  branchParent: { model: 'ccProfile', fk: 'profileId' },
  orderBy: { deadlineDate: 'asc' },
});

export const GET = crud.GET;
export const DELETE = crud.DELETE;

export async function POST(request: NextRequest) {
  const body = await request.clone().json().catch(() => ({}));
  if (body.deadlineDate) {
    const deadlineError = validateDeadline(String(body.deadlineDate));
    if (deadlineError) return errorResponse('VALIDATION_ERROR', deadlineError);
  }
  return crud.POST(request);
}
