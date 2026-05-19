import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { checkConflicts } from '@/modules/schedule/services/conflict-checker';
import { withAuth } from '@/shared/lib/api-auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { classId, teacherId, subjectId, slotId, dayOfWeek, periodStart, periodEnd } = body;

    const existing = await prisma.scheduleEntry.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Запись расписания не найдена', 404);
    }

    const newTeacherId = teacherId ?? existing.teacherId;
    const newDayOfWeek = dayOfWeek !== undefined ? Number(dayOfWeek) : existing.dayOfWeek;
    const newSlotId = slotId ?? existing.slotId;
    const newPeriodStart = periodStart ? new Date(periodStart) : existing.periodStart;
    const newPeriodEnd = periodEnd ? new Date(periodEnd) : existing.periodEnd;

    // Check conflicts excluding current entry
    const conflicts = await checkConflicts(
      newTeacherId,
      newDayOfWeek,
      newSlotId,
      newPeriodStart,
      newPeriodEnd,
      id,
    );

    if (conflicts.length > 0) {
      return errorResponse(
        'CONFLICT',
        `Конфликт: педагог уже занят в это время (${conflicts.map((c) => `${c.class.grade}${c.class.letter} — ${c.subject.name}`).join(', ')})`,
        409,
      );
    }

    const entry = await prisma.scheduleEntry.update({
      where: { id },
      data: {
        ...(classId !== undefined && { classId }),
        ...(teacherId !== undefined && { teacherId }),
        ...(subjectId !== undefined && { subjectId }),
        ...(slotId !== undefined && { slotId }),
        ...(dayOfWeek !== undefined && { dayOfWeek: Number(dayOfWeek) }),
        ...(periodStart !== undefined && { periodStart: new Date(periodStart) }),
        ...(periodEnd !== undefined && { periodEnd: new Date(periodEnd) }),
      },
      include: {
        class: { select: { id: true, grade: true, letter: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, middleName: true } },
        subject: { select: { id: true, name: true, color: true } },
        slot: { select: { id: true, slotNumber: true, startTime: true, endTime: true, type: true } },
      },
    });

    return successResponse(entry);
  } catch (error) {
    console.error('PUT /api/v1/schedule/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить запись расписания', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await withAuth(request, {
      roles: ['super_admin', 'zavuch'],
    });
    if (auth.response) return auth.response;

    const { id } = await params;

    const existing = await prisma.scheduleEntry.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'Запись расписания не найдена', 404);
    }

    await prisma.scheduleEntry.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/v1/schedule/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить запись расписания', 500);
  }
}
