import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { canAccessStudent } from '@/shared/lib/student-access';

const ROLES = ['uniform_manager', 'super_admin'] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId')?.trim();
    const className = searchParams.get('className')?.trim();

    if (studentId) {
      const allowed = await canAccessStudent(
        auth.session.user.role,
        auth.session.user.id,
        studentId,
        auth.session.user.branchId,
      );
      if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к ученику', 403);
    }

    const rows = await prisma.uniformIssue.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(className ? { className } : {}),
      },
      include: {
        item: { select: { id: true, name: true, category: true, basic: true, price: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });

    return successResponse(rows);
  } catch (error) {
    console.error('GET /api/v1/uniform/issues error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить выдачи', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: [...ROLES] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const itemId = String(body.itemId ?? '').trim();
    const size = String(body.size ?? '').trim();
    const studentId = String(body.studentId ?? '').trim();
    const className = body.className ? String(body.className).trim() : null;
    const paid = Boolean(body.paid);
    const amount = paid ? Number(body.amount ?? 0) : 0;
    const note = body.note ? String(body.note).trim() : null;

    if (!itemId || !size || !studentId) {
      return errorResponse('VALIDATION_ERROR', 'Поля itemId, size и studentId обязательны');
    }
    if (!Number.isInteger(amount) || amount < 0) {
      return errorResponse('VALIDATION_ERROR', 'Сумма должна быть неотрицательным целым числом');
    }

    const allowed = await canAccessStudent(
      auth.session.user.role,
      auth.session.user.id,
      studentId,
      auth.session.user.branchId,
    );
    if (!allowed) return errorResponse('FORBIDDEN', 'Нет доступа к ученику', 403);

    const issue = await prisma.$transaction(async (tx) => {
      const updated = await tx.uniformVariant.updateMany({
        where: { itemId, size, available: { gt: 0 } },
        data: { available: { decrement: 1 } },
      });

      if (updated.count === 0) {
        throw new Error('NO_STOCK');
      }

      return tx.uniformIssue.create({
        data: {
          itemId,
          size,
          studentId,
          className,
          paid,
          amount: paid ? amount : 0,
          note,
          issuedById: auth.session.user.id,
        },
        include: {
          item: { select: { id: true, name: true, category: true, basic: true, price: true } },
        },
      });
    });

    return successResponse(issue, 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_STOCK') {
      return errorResponse('NO_STOCK', 'Нет остатка по размеру');
    }
    console.error('POST /api/v1/uniform/issues error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось выдать форму', 500);
  }
}
