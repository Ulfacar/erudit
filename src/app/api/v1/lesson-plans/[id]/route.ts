import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'] as const;
const isAdmin = (r: string) => r === 'super_admin' || r === 'analyst' || r === 'zavuch';

async function owned(id: string, userId: string, role: string) {
  const plan = await prisma.lessonPlan.findUnique({ where: { id } });
  if (!plan) return { error: errorResponse('NOT_FOUND', 'План урока не найден', 404) };
  if (!isAdmin(role)) {
    const scope = await getTeacherScope(userId);
    if (!scope || plan.teacherId !== scope.teacherId) {
      return { error: errorResponse('FORBIDDEN', 'Это не ваш план урока', 403) };
    }
  }
  return { plan };
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const { plan, error } = await owned(id, auth.session.user.id, auth.session.user.role);
    if (error) return error;
    return successResponse(plan);
  } catch (error) {
    console.error('GET /api/v1/lesson-plans/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить план урока', 500);
  }
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const { error } = await owned(id, auth.session.user.id, auth.session.user.role);
    if (error) return error;

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title).trim().slice(0, 200);
    if (body.date !== undefined) data.date = body.date ? new Date(String(body.date)) : null;
    if (body.duration !== undefined) data.duration = Number(body.duration) || 45;
    if (body.objectives !== undefined) data.objectives = body.objectives ? String(body.objectives).slice(0, 2000) : null;
    if (body.stages !== undefined) data.stages = Array.isArray(body.stages) ? body.stages : [];
    if (body.homework !== undefined) data.homework = body.homework ? String(body.homework).slice(0, 2000) : null;
    if (body.subjectId !== undefined) data.subjectId = body.subjectId ? String(body.subjectId) : null;
    if (body.classId !== undefined) data.classId = body.classId ? String(body.classId) : null;

    const updated = await prisma.lessonPlan.update({ where: { id }, data });
    return successResponse(updated);
  } catch (error) {
    console.error('PUT /api/v1/lesson-plans/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить план урока', 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const { error } = await owned(id, auth.session.user.id, auth.session.user.role);
    if (error) return error;
    await prisma.lessonPlan.delete({ where: { id } });
    return successResponse({ id });
  } catch (error) {
    console.error('DELETE /api/v1/lesson-plans/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить план урока', 500);
  }
}
