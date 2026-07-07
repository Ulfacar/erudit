import { type NextRequest } from 'next/server';
import { type Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { createCrudId } from '@/shared/lib/crud';
import { canAccessCcProfileBranch } from '@/modules/cc/server-branch-access';
import { CC_ROLES } from '@/modules/cc/roles';
import { validateDeadline } from '@/modules/cc/deadline';

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

function achievementDescription(app: { country: string | null; program: string | null }) {
  return [app.country, app.program].filter(Boolean).join('\n') || null;
}

async function syncApplicationOutcome(
  app: {
    admissionStatus: string;
    profileId: string;
    profile: { studentId: string; alumniAbroad: boolean };
  },
  saved: {
    universityName: string;
    country: string | null;
    program: string | null;
  },
  nextStatus: string,
  authorId: string,
) {
  if (app.admissionStatus === nextStatus) return;

  const shouldBeAlumni = nextStatus === 'accepted_final';
  if (app.profile.alumniAbroad !== shouldBeAlumni) {
    try {
      await prisma.ccProfile.update({ where: { id: app.profileId }, data: { alumniAbroad: shouldBeAlumni } });
    } catch (error) {
      console.error('set CC alumniAbroad failed:', error);
    }
  }

  if (nextStatus !== 'offer_received' && nextStatus !== 'accepted_final') return;

  try {
    const title = `${nextStatus === 'offer_received' ? `Оффер: ${saved.universityName}` : `Зачислен: ${saved.universityName}`}${saved.program ? ` — ${saved.program}` : ''}`;
    const existing = await prisma.achievement.findFirst({
      where: { studentId: app.profile.studentId, title },
      select: { id: true },
    });
    if (!existing) {
      await prisma.achievement.create({
        data: {
          studentId: app.profile.studentId,
          title,
          description: achievementDescription(saved),
          category: 'academic',
          level: 'international',
          place: nextStatus === 'offer_received' ? 'оффер' : 'зачислен',
          date: new Date(),
          authorId,
        },
      });
    }
  } catch (error) {
    console.error('sync CC application outcome failed:', error);
  }
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

async function handleUpdate(request: NextRequest, ctx: { params: Promise<{ id: string }> }, logLabel: string) {
  try {
    const auth = await withAuth(request, { roles: [...CC_ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const body = await request.json();
    const data = pickUpdate(body);
    if (body.deadlineDate) {
      const deadlineError = validateDeadline(String(body.deadlineDate));
      if (deadlineError) return errorResponse('VALIDATION_ERROR', deadlineError);
    }
    const validation = await validateTransition(id, data, auth.session.user);
    if ('response' in validation) return validation.response;

    const updated = await prisma.ccApplication.update({ where: { id }, data });
    await syncApplicationOutcome(validation.app, updated, validation.nextStatus, auth.session.user.id);
    return successResponse(updated);
  } catch (error) {
    console.error(`${logLabel} /api/v1/cc/applications/[id] error:`, error);
    const message = logLabel === 'PATCH' ? 'Не удалось обновить статус заявки' : 'Не удалось обновить заявку';
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleUpdate(request, ctx, 'PUT');
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleUpdate(request, ctx, 'PATCH');
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
