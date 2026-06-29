import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/finance/journal — журнал оплат: разбивка по способам (нал/карта/мбанк/
 * банк), список последних платежей (с филиалом и статусом верификации). Сердце
 * бухгалтерского журнала «кто внёс».
 */
const ROLES = ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'] as const;

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  try {
    const payments = await prisma.payment.findMany({
      orderBy: { paidAt: 'desc' }, take: 200,
      include: { invoice: { select: { title: true, studentId: true } } },
    });
    const studentIds = [...new Set(payments.map((p) => p.invoice.studentId))];
    const students = await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true, branchId: true } });
    const branchIds = [...new Set(students.map((s) => s.branchId).filter(Boolean) as string[])];
    const branches = await prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } });

    // разбивка по способам оплаты
    const byMethod = new Map<string, { count: number; total: number }>();
    for (const p of payments) {
      const m = p.method || 'не указан';
      const b = byMethod.get(m) ?? { count: 0, total: 0 };
      b.count++; b.total += p.amount; byMethod.set(m, b);
    }

    const rows = payments.slice(0, 100).map((p) => {
      const s = students.find((x) => x.id === p.invoice.studentId);
      const br = s?.branchId ? branches.find((x) => x.id === s.branchId)?.name : null;
      return {
        id: p.id, amount: p.amount, method: p.method, paidAt: p.paidAt, verified: p.verified,
        studentName: s ? `${s.lastName} ${s.firstName}` : '—', branch: br ?? '—', title: p.invoice.title,
      };
    });

    return successResponse({
      byMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.total - a.total),
      payments: rows,
      unverifiedCount: payments.filter((p) => !p.verified).length,
    });
  } catch (e) {
    console.error('GET finance/journal error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить журнал', 500);
  }
}
