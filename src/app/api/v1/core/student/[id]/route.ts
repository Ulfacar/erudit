import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { resolveScope } from '@/shared/lib/ai/scope';
import { executeTool } from '@/shared/lib/ai/tools';

/**
 * GET /api/v1/core/student/[id] — карточка 360° для графа ядра.
 * РЕЮЗ инструментов ассистента: те же зоны доступа применяются автоматически
 * (учитель не получит финансы, секретарь — психолога и т.д.).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const { id } = await ctx.params;

    const scope = await resolveScope(auth.session.user);
    const [profileRaw, financeRaw, psychRaw] = await Promise.all([
      executeTool('student_profile', { studentId: id }, scope),
      executeTool('student_finance', { studentId: id }, scope),
      executeTool('student_psych', { studentId: id }, scope),
    ]);

    const parse = (s: string) => {
      const v = JSON.parse(s) as Record<string, unknown>;
      return 'error' in v ? null : v;
    };
    const profile = parse(profileRaw);
    if (!profile) return errorResponse('FORBIDDEN', 'Ученик вне зоны доступа', 403);

    return successResponse({
      profile,
      finance: parse(financeRaw),
      psych: parse(psychRaw),
    });
  } catch (error) {
    console.error('GET /api/v1/core/student/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить карточку', 500);
  }
}
