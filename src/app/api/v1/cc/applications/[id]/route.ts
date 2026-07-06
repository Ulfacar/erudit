import { type NextRequest } from 'next/server';
import { type Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { createCrudId } from '@/shared/lib/crud';
import { canAccessCcProfileBranch } from '@/modules/cc/server-branch-access';
import { CC_ROLES } from '@/modules/cc/roles';

const STATUS_ORDER = ['scouting', 'document_prep', 'submitted', 'decision_pending', 'offer_received', 'rejected', 'accepted_final'] as const;
const SUBMITTED_OR_LATER = new Set(['submitted', 'decision_pending', 'offer_received', 'rejected', 'accepted_final']);

const crud = createCrudId({
  model: 'ccApplication',
  writeRoles: [...CC_ROLES],
});

function parseDate(value: unknown) {
  return value ? new Date(String(value)) : null;
}

function pickUpdate(body: Record<string, unknown>): Prisma.CcApplicationUpdateInput {
  const fields = [
    'universityName',
    'country',
    'program',
    'applicationType',
    'admissionStatus',
    'deadlineDate',
    'decisionDate',
    'applicationId',
    'submissionProof',
    'scholarshipAmount',
    'scholarshipType',
    'comment',
  ] as const;
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    if (body[field] === undefined) continue;
    data[field] = field === 'deadlineDate' || field === 'decisionDate' ? parseDate(body[field]) : body[field];
  }
  return data;
}

async function validateTransition(
  id: string,
  data: Prisma.CcApplicationUpdateInput,
  user: { id: string; role: string; branchId?: string | null },
) {
  const app = await prisma.ccApplication.findUnique({
    where: { id },
    include: { profile: true },
  });
  if (!app) return { response: errorResponse('NOT_FOUND', 'Заявка не найдена', 404) };

  if (!(await canAccessCcProfileBranch(user, app.profile.branchId))) {
    return { response: errorResponse('FORBIDDEN', 'Forbidden', 403) };
  }

  const statusProvided = Object.prototype.hasOwnProperty.call(data, 'admissionStatus');
  const nextStatus = statusProvided ? String(data.admissionStatus) : app.admissionStatus;
  if (!STATUS_ORDER.includes(nextStatus as typeof STATUS_ORDER[number])) {
    return { response: errorResponse('VALIDATION_ERROR', 'Некорректный admissionStatus') };
  }

  const statusChanged = statusProvided && nextStatus !== app.admissionStatus;
  if (statusChanged && SUBMITTED_OR_LATER.has(nextStatus) && app.profile.conflictStatus === 'red' && !app.profile.riskFlagCleared) {
    return { response: errorResponse('CONFLICT', 'Снимите RED-флаг перед отправкой заявки', 409) };
  }

  const nextApplicationId = String(data.applicationId ?? app.applicationId ?? '').trim();
  const nextProof = String(data.submissionProof ?? app.submissionProof ?? '').trim();
  if (nextStatus === 'submitted' && !nextApplicationId && !nextProof) {
    return { response: errorResponse('VALIDATION_ERROR', 'Для submitted нужен applicationId или submissionProof') };
  }

  return { app, nextStatus };
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...CC_ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const body = await request.json();
    const data = pickUpdate(body);
    const validation = await validateTransition(id, data, auth.session.user);
    if ('response' in validation) return validation.response;

    const updated = await prisma.ccApplication.update({ where: { id }, data });
    return successResponse(updated);
  } catch (error) {
    console.error('PUT /api/v1/cc/applications/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить заявку', 500);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...CC_ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const body = await request.json();
    const data = pickUpdate(body);
    const validation = await validateTransition(id, data, auth.session.user);
    if ('response' in validation) return validation.response;

    const updated = await prisma.ccApplication.update({ where: { id }, data });
    return successResponse(updated);
  } catch (error) {
    console.error('PATCH /api/v1/cc/applications/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить статус заявки', 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...CC_ROLES] });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const app = await prisma.ccApplication.findUnique({
    where: { id },
    select: { profile: { select: { branchId: true } } },
  });
  if (!app) return errorResponse('NOT_FOUND', 'Заявка не найдена', 404);
  if (!(await canAccessCcProfileBranch(auth.session.user, app.profile.branchId))) {
    return errorResponse('FORBIDDEN', 'Forbidden', 403);
  }
  return crud.DELETE(request, ctx);
}
