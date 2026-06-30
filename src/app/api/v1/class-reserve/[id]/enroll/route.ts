import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;

function inferTargetGrade(desiredYear: string | null | undefined) {
  if (!desiredYear) return 0;
  const match = desiredYear.match(/\d+/);
  return match ? Number(match[0]) || 0 : 0;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;

    const entry = await prisma.classReserveEntry.findUnique({ where: { id } });
    if (!entry) return errorResponse('NOT_FOUND', 'Запись очереди не найдена', 404);
    if (entry.leadId || entry.status === 'enrolled') {
      return errorResponse('ALREADY_ENROLLED', 'По этой записи уже создана заявка', 409);
    }

    const lead = await prisma.$transaction(async (tx) => {
      const cls = await tx.class.findUnique({
        where: { id: entry.classId },
        select: { grade: true, branchId: true },
      });
      const created = await tx.admissionLead.create({
        data: {
          childName: entry.childName,
          parentName: entry.parentName || '—',
          phone: entry.parentPhone || '—',
          classId: entry.classId,
          targetGrade: cls?.grade ?? inferTargetGrade(entry.desiredYear),
          stage: 'lead',
          branchId: entry.branchId ?? cls?.branchId ?? null,
          createdById: auth.session.user.id,
          source: 'Очередь',
        },
        select: { id: true },
      });

      await tx.classReserveEntry.update({
        where: { id },
        data: { leadId: created.id, status: 'enrolled' },
      });

      return created;
    });

    return successResponse({ leadId: lead.id });
  } catch (error) {
    console.error('POST class-reserve enroll error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать заявку из очереди', 500);
  }
}
