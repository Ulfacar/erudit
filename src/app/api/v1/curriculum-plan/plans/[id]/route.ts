import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'] as const;

function isAdmin(role: string) {
  return role === 'super_admin' || role === 'analyst' || role === 'zavuch';
}

async function loadOwned(id: string, userId: string, role: string) {
  const plan = await prisma.curriculumPlan.findUnique({
    where: { id },
    include: { topics: { orderBy: { order: 'asc' } } },
  });
  if (!plan) return { error: errorResponse('NOT_FOUND', 'План не найден', 404) };
  if (!isAdmin(role)) {
    const scope = await getTeacherScope(userId);
    if (!scope || plan.teacherId !== scope.teacherId) {
      return { error: errorResponse('FORBIDDEN', 'Это не ваш план', 403) };
    }
  }
  return { plan };
}

/** GET — план + темы. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const { plan, error } = await loadOwned(id, auth.session.user.id, auth.session.user.role);
    if (error) return error;
    return successResponse(plan);
  } catch (error) {
    console.error('GET /api/v1/curriculum-plan/plans/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить план', 500);
  }
}

/** PUT — обновить название и заменить список тем целиком. */
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const { plan, error } = await loadOwned(id, auth.session.user.id, auth.session.user.role);
    if (error) return error;

    const body = await request.json();
    const title = body.title !== undefined ? String(body.title).trim() : plan!.title;
    const rawTopics: unknown[] = Array.isArray(body.topics) ? body.topics : [];
    const topics = rawTopics
      .map((raw, i: number) => {
        const t = (raw ?? {}) as Record<string, unknown>;
        return ({
        order: i,
        title: String(t.title ?? '').trim().slice(0, 300),
        hours: Number.isFinite(Number(t.hours)) ? Math.max(0, Math.min(999, Number(t.hours))) : 1,
        plannedAt: t.plannedAt ? new Date(String(t.plannedAt)) : null,
        done: Boolean(t.done),
      });
      })
      .filter((t) => t.title.length > 0);

    await prisma.$transaction([
      prisma.curriculumPlan.update({ where: { id }, data: { title } }),
      prisma.curriculumTopic.deleteMany({ where: { planId: id } }),
      ...(topics.length
        ? [prisma.curriculumTopic.createMany({ data: topics.map((t) => ({ ...t, planId: id })) })]
        : []),
    ]);

    const updated = await prisma.curriculumPlan.findUnique({
      where: { id },
      include: { topics: { orderBy: { order: 'asc' } } },
    });
    return successResponse(updated);
  } catch (error) {
    console.error('PUT /api/v1/curriculum-plan/plans/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить план', 500);
  }
}

/** DELETE — удалить план (темы каскадно). */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const { error } = await loadOwned(id, auth.session.user.id, auth.session.user.role);
    if (error) return error;
    await prisma.curriculumPlan.delete({ where: { id } });
    return successResponse({ id });
  } catch (error) {
    console.error('DELETE /api/v1/curriculum-plan/plans/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить план', 500);
  }
}
