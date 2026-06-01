import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { generateLessonPlan } from '@/shared/lib/ai/lesson-plan';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'] as const;

/** POST — сгенерировать ЧЕРНОВИК поурочного плана (не сохраняет). */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const topic = String(body.topic ?? '').trim();
    if (topic.length < 3) return errorResponse('VALIDATION_ERROR', 'Укажите тему урока');

    const draft = await generateLessonPlan({
      topic,
      subject: body.subject ? String(body.subject) : null,
      gradeLevel: body.gradeLevel ? String(body.gradeLevel) : null,
      duration: Number.isFinite(Number(body.duration)) ? Number(body.duration) : 45,
    });
    return successResponse(draft);
  } catch (error) {
    console.error('POST /api/v1/lesson-plans/generate error:', error);
    return errorResponse('AI_ERROR', 'ИИ не смог составить план. Попробуйте ещё раз.', 502);
  }
}
