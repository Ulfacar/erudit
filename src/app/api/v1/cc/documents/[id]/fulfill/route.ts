import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { closeRecommendationTask } from '@/modules/cc/recommendation';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: ['teacher', 'super_admin'] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : '';
    if (!fileUrl) return errorResponse('VALIDATION_ERROR', 'fileUrl обязателен');

    const document = await prisma.ccDocument.findUnique({ where: { id } });
    if (!document) return errorResponse('NOT_FOUND', 'Документ не найден', 404);
    if (document.docType !== 'recommendation') {
      return errorResponse('VALIDATION_ERROR', 'Закрыть так можно только рекомендацию');
    }

    if (auth.session.user.role !== 'super_admin') {
      const teacher = await prisma.teacher.findFirst({ where: { userId: auth.session.user.id }, select: { id: true } });
      if (!teacher || document.teacherId !== teacher.id) {
        return errorResponse('FORBIDDEN', 'Это не ваша рекомендация', 403);
      }
    }

    const updated = await prisma.ccDocument.update({
      where: { id },
      data: { fileUrl, status: 'received', receivedAt: new Date() },
    });

    await closeRecommendationTask(id, auth.session.user.id);

    return successResponse(updated);
  } catch (error) {
    console.error('POST /api/v1/cc/documents/[id]/fulfill error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить рекомендацию', 500);
  }
}
