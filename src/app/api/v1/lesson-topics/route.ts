import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getTeacherScope } from '@/shared/lib/teacher-scope';

/**
 * GET /api/v1/lesson-topics?classId=&subjectId=&date=YYYY-MM-DD
 * Тема урока (EduPage): что прошли на конкретном уроке (class+subject+date).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');
    const date = searchParams.get('date');

    const where: Record<string, unknown> = {};
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    if (date) {
      const d = new Date(date);
      where.date = { gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()), lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) };
    }

    const topics = await prisma.lessonTopic.findMany({ where, orderBy: { date: 'desc' } });
    return successResponse(topics);
  } catch (error) {
    console.error('GET /api/v1/lesson-topics error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить темы', 500);
  }
}

/**
 * POST /api/v1/lesson-topics — upsert темы урока (учитель/завуч/админ).
 * Учитель может писать тему только по своему классу/предмету.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['teacher', 'curator', 'super_admin', 'zavuch'] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const { classId, subjectId, date, topic } = body;
    if (!classId || !subjectId || !date) {
      return errorResponse('VALIDATION_ERROR', 'Поля classId, subjectId, date обязательны');
    }

    const role = auth.session.user.role;
    let teacherId: string | null = null;
    if (role === 'teacher' || role === 'curator') {
      const scope = await getTeacherScope(auth.session.user.id);
      if (!scope || !scope.classIds.includes(classId)) {
        return errorResponse('FORBIDDEN', 'Нет доступа к этому классу', 403);
      }
      teacherId = scope.teacherId;
    }

    const day = new Date(date);
    const normDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());

    const saved = await prisma.lessonTopic.upsert({
      where: { classId_subjectId_date: { classId, subjectId, date: normDate } },
      update: { topic: topic ?? '', teacherId },
      create: { classId, subjectId, date: normDate, topic: topic ?? '', teacherId },
    });
    return successResponse(saved, 201);
  } catch (error) {
    console.error('POST /api/v1/lesson-topics error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить тему', 500);
  }
}
