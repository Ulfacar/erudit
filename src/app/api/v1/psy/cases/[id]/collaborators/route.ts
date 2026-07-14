import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';

function displayName(user: {
  login: string;
  teacher: { firstName: string; lastName: string; middleName: string | null } | null;
}) {
  const fio = user.teacher
    ? [user.teacher.lastName, user.teacher.firstName, user.teacher.middleName].filter(Boolean).join(' ')
    : '';
  return fio || user.login;
}

async function loadCaseForManage(caseId: string, userId: string, role: (typeof PSY_CABINET_ROLES)[number]) {
  const scope = getPsyScope(userId, role);
  const c = await prisma.psyCase.findUnique({ where: { id: caseId }, select: { id: true, ownerId: true } });
  if (!c || (c.ownerId !== userId && !scope.full)) return { error: errorResponse('FORBIDDEN', 'No permission to manage collaborators', 403) };
  return { c, scope };
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, id))) return errorResponse('FORBIDDEN', 'No access to this case', 403);

  try {
    const rows = await prisma.psyCaseCollaborator.findMany({
      where: { caseId: id },
      select: { id: true, userId: true, status: true },
      orderBy: { requestedAt: 'asc' },
    });
    const users = rows.length
      ? await prisma.user.findMany({
          where: { id: { in: rows.map((row) => row.userId) } },
          select: {
            id: true,
            login: true,
            teacher: { select: { firstName: true, lastName: true, middleName: true } },
          },
        })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));

    return successResponse(rows.map((row) => {
      const user = userById.get(row.userId);
      return {
        id: row.id,
        userId: row.userId,
        status: row.status,
        login: user?.login ?? null,
        name: user ? displayName(user) : row.userId,
      };
    }));
  } catch (e) {
    console.error('GET psy/cases/[id]/collaborators error:', e);
    return errorResponse('INTERNAL_ERROR', 'Failed to load collaborators', 500);
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const manage = await loadCaseForManage(id, auth.session.user.id, auth.session.user.role);
  if (manage.error) return manage.error;

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId) return errorResponse('VALIDATION_ERROR', 'userId is required');
  if (userId === manage.c.ownerId) return errorResponse('VALIDATION_ERROR', 'Owner cannot be added as collaborator');

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user || !CASE_OWNER_ROLES.includes(user.role)) {
      return errorResponse('VALIDATION_ERROR', 'User cannot own psy cases');
    }

    const created = await prisma.psyCaseCollaborator.upsert({
      where: { caseId_userId: { caseId: id, userId } },
      create: { caseId: id, userId, status: 'accepted', decidedAt: new Date() },
      update: { status: 'accepted', decidedAt: new Date() },
      select: { id: true, userId: true, status: true },
    });
    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/cases/[id]/collaborators error:', e);
    return errorResponse('INTERNAL_ERROR', 'Failed to add collaborator', 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const manage = await loadCaseForManage(id, auth.session.user.id, auth.session.user.role);
  if (manage.error) return manage.error;

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  if (!userId) return errorResponse('VALIDATION_ERROR', 'userId is required');

  try {
    await prisma.psyCaseCollaborator.deleteMany({ where: { caseId: id, userId } });
    return successResponse({ userId });
  } catch (e) {
    console.error('DELETE psy/cases/[id]/collaborators error:', e);
    return errorResponse('INTERNAL_ERROR', 'Failed to remove collaborator', 500);
  }
}
