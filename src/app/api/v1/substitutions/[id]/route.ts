import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { date, originalTeacherId, substituteTeacherId, classId, subjectId, slotId, reason } = body;

    const existing = await prisma.substitution.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Замена не найдена', 404);
    }

    const substitution = await prisma.substitution.update({
      where: { id },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(originalTeacherId !== undefined && { originalTeacherId }),
        ...(substituteTeacherId !== undefined && { substituteTeacherId }),
        ...(classId !== undefined && { classId }),
        ...(subjectId !== undefined && { subjectId }),
        ...(slotId !== undefined && { slotId }),
        ...(reason !== undefined && { reason }),
      },
      include: {
        substitute: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    });

    return successResponse(substitution);
  } catch (error) {
    console.error('PUT /api/v1/substitutions/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить замену', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const { id } = await params;

    const existing = await prisma.substitution.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Замена не найдена', 404);
    }

    await prisma.substitution.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/v1/substitutions/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить замену', 500);
  }
}
