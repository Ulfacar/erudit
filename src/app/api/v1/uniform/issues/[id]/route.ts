import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { canAccessStudent } from '@/shared/lib/student-access';
import { recordUniformPayment } from '@/shared/lib/uniform/record-payment';
import { canAccessBranch, getBranchScope } from '@/shared/lib/branch-scope';
import type { Role } from '@prisma/client';

const ROLES = ['uniform_manager', 'super_admin'] as const;

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;

    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? '').trim();
    const method = body.method ? String(body.method) : undefined;

    if (action !== 'confirm' && action !== 'cancel') {
      return errorResponse('VALIDATION_ERROR', 'Укажите action: confirm или cancel');
    }

    const issue = await prisma.uniformIssue.findUnique({
      where: { id },
      include: {
        item: { select: { id: true, name: true } },
        student: { select: { branchId: true } },
      },
    });
    if (!issue) return errorResponse('NOT_FOUND', 'Бронь не найдена', 404);

    const scope = await getBranchScope(auth.session.user.id, auth.session.user.role as Role, auth.session.user.branchId);
    if (!canAccessBranch(scope, issue.student?.branchId ?? null)) {
      return errorResponse('FORBIDDEN', 'Нет доступа к филиалу', 403);
    }

    const allowed = await canAccessStudent(
      auth.session.user.role,
      auth.session.user.id,
      issue.studentId,
      auth.session.user.branchId,
    );
    if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к ученику', 403);

    if (action === 'cancel') {
      const cancelled = await prisma.uniformIssue.updateMany({
        where: { id, status: 'reserved' },
        data: { status: 'cancelled' },
      });
      if (cancelled.count === 0) {
        return errorResponse('VALIDATION_ERROR', 'Бронь уже обработана');
      }

      const row = await prisma.uniformIssue.findUniqueOrThrow({
        where: { id },
        include: { item: { select: { id: true, name: true, category: true, basic: true, price: true } } },
      });
      return successResponse(row);
    }

    const confirmed = await prisma.$transaction(async (tx) => {
      const claim = await tx.uniformIssue.updateMany({
        where: { id, status: 'reserved' },
        data: {
          status: 'issued',
          issuedById: auth.session.user.id,
        },
      });
      if (claim.count === 0) throw new Error('ALREADY_PROCESSED');

      const dec = await tx.uniformVariant.updateMany({
        where: { itemId: issue.itemId, size: issue.size, available: { gt: 0 } },
        data: { available: { decrement: 1 } },
      });
      if (dec.count === 0) throw new Error('NO_STOCK');

      const issued = await tx.uniformIssue.findUniqueOrThrow({
        where: { id },
        include: { item: { select: { id: true, name: true, category: true, basic: true, price: true } } },
      });

      if (issued.paid) {
        await recordUniformPayment(tx, {
          issueId: issued.id,
          studentId: issued.studentId,
          itemName: issued.item.name,
          size: issued.size,
          amount: issued.amount ?? 0,
          recordedBy: auth.session.user.id,
          method,
        });
      }

      return tx.uniformIssue.findUniqueOrThrow({
        where: { id },
        include: { item: { select: { id: true, name: true, category: true, basic: true, price: true } } },
      });
    });

    return successResponse(confirmed);
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_STOCK') {
      return errorResponse('NO_STOCK', 'Нет остатка по размеру');
    }
    if (error instanceof Error && error.message === 'ALREADY_PROCESSED') {
      return errorResponse('VALIDATION_ERROR', 'Бронь уже обработана');
    }
    console.error('PATCH /api/v1/uniform/issues/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обработать бронь', 500);
  }
}
