import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/news/[id]
 * Get a single news item by ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { id } = await params;

    const news = await prisma.news.findUnique({
      where: { id },
      include: {
        class: {
          select: { id: true, grade: true, letter: true },
        },
      },
    });

    if (!news) {
      return errorResponse('NOT_FOUND', 'Новость не найдена', 404);
    }

    // Resolve author name
    const user = await prisma.user.findUnique({
      where: { id: news.authorId },
      select: { id: true, login: true },
    });
    const teacher = await prisma.teacher.findFirst({
      where: { userId: news.authorId },
      select: { firstName: true, lastName: true },
    });

    const authorName = teacher
      ? `${teacher.lastName} ${teacher.firstName}`
      : user?.login || 'Неизвестный';

    return successResponse({ ...news, authorName });
  } catch (error) {
    console.error('GET /api/v1/news/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить новость', 500);
  }
}

/**
 * PUT /api/v1/news/[id]
 * Update a news item. Only author or admin.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { title, content, type, classId, isPublished } = body;

    const existing = await prisma.news.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Новость не найдена', 404);
    }

    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    // Only author or admin can edit
    if (existing.authorId !== userId && role !== 'super_admin') {
      return errorResponse('FORBIDDEN', 'Только автор или администратор может редактировать новость', 403);
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (classId !== undefined) updateData.classId = classId || null;
    if (isPublished !== undefined) updateData.isPublished = isPublished;

    const updated = await prisma.news.update({
      where: { id },
      data: updateData,
      include: {
        class: {
          select: { id: true, grade: true, letter: true },
        },
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('PUT /api/v1/news/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить новость', 500);
  }
}

/**
 * DELETE /api/v1/news/[id]
 * Delete a news item. Only author or admin.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;

    const { id } = await params;

    const existing = await prisma.news.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Новость не найдена', 404);
    }

    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    // Only author or admin can delete
    if (existing.authorId !== userId && role !== 'super_admin') {
      return errorResponse('FORBIDDEN', 'Только автор или администратор может удалить новость', 403);
    }

    await prisma.news.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/v1/news/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить новость', 500);
  }
}
