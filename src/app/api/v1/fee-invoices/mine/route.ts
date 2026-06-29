import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { computePenalty } from '@/shared/lib/finance/penalty';
import { verifiedPaidTotal } from '@/shared/lib/finance/invoice-status';

/**
 * Счета «мои»: родитель видит счета своих детей, ученик — свои.
 * Row-level scoping по ParentStudent/userId (паттерн students/[id]/grades).
 * Пеня считается на сервере — клиент получает готовые remaining/penalty.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['parent', 'student'] });
    if (auth.response) return auth.response;
    const role = auth.session.user.role;
    const userId = auth.session.user.id;

    let studentIds: string[] = [];
    if (role === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { userId },
        include: { children: { select: { studentId: true } } },
      });
      studentIds = parent?.children.map((l) => l.studentId) ?? [];
    } else {
      const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
      if (student) studentIds = [student.id];
    }
    if (studentIds.length === 0) return successResponse([]);

    const [invoices, students] = await Promise.all([
      prisma.feeInvoice.findMany({
        where: { studentId: { in: studentIds } },
        include: { payments: { select: { amount: true, paidAt: true, method: true, verified: true } } },
        orderBy: { dueDate: 'desc' },
      }),
      prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);
    const nameById = new Map(students.map((s) => [s.id, `${s.lastName} ${s.firstName}`]));

    const enriched = invoices.map((inv) => {
      const { overdueDays, remaining, penalty } = computePenalty(inv);
      return {
        id: inv.id,
        studentId: inv.studentId,
        studentName: nameById.get(inv.studentId) ?? '',
        title: inv.title,
        period: inv.period,
        amount: inv.amount,
        status: inv.status,
        dueDate: inv.dueDate,
        paid: verifiedPaidTotal(inv.payments),
        remaining,
        penalty,
        overdueDays,
        payments: inv.payments,
      };
    });

    return successResponse(enriched);
  } catch (error) {
    console.error('GET /api/v1/fee-invoices/mine error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить счета', 500);
  }
}
