import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

function payloadDocumentId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as { documentId?: unknown }).documentId;
  return typeof value === 'string' ? value : null;
}

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

    const openItems = await prisma.agentItem.findMany({
      where: {
        ruleKey: 'cc-recommendation-requested',
        status: { in: ['new', 'in_progress'] },
      },
      select: { id: true, payload: true },
    });
    const item = openItems.find((candidate) => payloadDocumentId(candidate.payload) === id);
    if (item) {
      await prisma.agentItem.update({
        where: { id: item.id },
        data: { status: 'done', resolvedAt: new Date(), resolvedBy: auth.session.user.id },
      });
      await prisma.agentActionLog.create({
        data: { itemId: item.id, action: 'done', byUserId: auth.session.user.id, detail: { documentId: id } },
      });
    }

    return successResponse(updated);
  } catch (error) {
    console.error('POST /api/v1/cc/documents/[id]/fulfill error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить рекомендацию', 500);
  }
}
