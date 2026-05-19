import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { status, title, description, priority, visibleTo } = body;

    const existing = await prisma.urgentIssue.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Срочный вопрос не найден', 404);
    }

    const data: Record<string, unknown> = {};

    if (status) {
      data.status = status;
      if (status === 'resolved' || status === 'closed') {
        data.resolvedAt = new Date();
        data.resolvedBy = auth.session.user.id;
      }
    }

    if (title) data.title = title;
    if (description) data.description = description;
    if (priority) data.priority = priority;
    if (visibleTo) data.visibleTo = visibleTo;

    const updated = await prisma.urgentIssue.update({
      where: { id },
      data,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PUT /api/v1/urgent-issues/[id] error:', error);
    return errorResponse('UPDATE_ERROR', 'Не удалось обновить срочный вопрос', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { id } = await params;

    const existing = await prisma.urgentIssue.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Срочный вопрос не найден', 404);
    }

    // Only author or admin can delete
    const isAuthor = existing.authorId === auth.session.user.id;
    const isAdmin = auth.session.user.role === 'super_admin';
    if (!isAuthor && !isAdmin) {
      return errorResponse('FORBIDDEN', 'Нет прав для удаления', 403);
    }

    await prisma.urgentIssue.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/v1/urgent-issues/[id] error:', error);
    return errorResponse('DELETE_ERROR', 'Не удалось удалить срочный вопрос', 500);
  }
}
