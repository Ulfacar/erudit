import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getTeacherScope } from '@/shared/lib/teacher-scope';
import { isLlmConfigured } from '@/shared/lib/ai/openrouter';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'] as const;
const isAdmin = (r: string) => r === 'super_admin' || r === 'analyst' || r === 'zavuch';

/** GET — мои поурочные планы. POST — создать. */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const scope = await getTeacherScope(auth.session.user.id);
    const where = isAdmin(auth.session.user.role) ? {} : { teacherId: scope?.teacherId ?? '__none__' };

    const items = await prisma.lessonPlan.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, subjectId: true, classId: true, date: true, duration: true, model: true, createdAt: true },
    });
    return successResponse({ items, llmConfigured: isLlmConfigured() });
  } catch (error) {
    console.error('GET /api/v1/lesson-plans error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить планы уроков', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const scope = await getTeacherScope(auth.session.user.id);
    if (!scope?.teacherId) {
      return errorResponse('VALIDATION_ERROR', 'Поурочные планы ведёт учитель (нет привязки к преподавателю)', 400);
    }

    const body = await request.json();
    const title = String(body.title ?? '').trim();
    if (title.length < 2) return errorResponse('VALIDATION_ERROR', 'Укажите название урока');

    const stages = Array.isArray(body.stages) ? body.stages : [];
    const saved = await prisma.lessonPlan.create({
      data: {
        teacherId: scope.teacherId,
        subjectId: body.subjectId ? String(body.subjectId) : null,
        classId: body.classId ? String(body.classId) : null,
        topicId: body.topicId ? String(body.topicId) : null,
        title: title.slice(0, 200),
        date: body.date ? new Date(String(body.date)) : null,
        duration: Number.isFinite(Number(body.duration)) ? Number(body.duration) : 45,
        objectives: body.objectives ? String(body.objectives).slice(0, 2000) : null,
        stages,
        homework: body.homework ? String(body.homework).slice(0, 2000) : null,
        model: body.model ? String(body.model) : null,
      },
    });
    return successResponse(saved, 201);
  } catch (error) {
    console.error('POST /api/v1/lesson-plans error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать план урока', 500);
  }
}
