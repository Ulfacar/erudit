import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { computePenalty } from '@/shared/lib/finance/penalty';

/**
 * Финансовая сводка для собственника/бухгалтера: KPI, должники, динамика.
 * Агрегация в JS поверх findMany — реюз computePenalty (датасет школьный, это дёшево).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'accountant', 'chief_accountant', 'finance_manager'] });
    if (auth.response) return auth.response;

    const [invoices, students, expenses] = await Promise.all([
      prisma.feeInvoice.findMany({
        where: { status: { not: 'cancelled' } },
        include: { payments: { select: { amount: true, paidAt: true } } },
      }),
      prisma.student.findMany({
        select: { id: true, firstName: true, lastName: true, class: { select: { grade: true, letter: true } } },
      }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
    ]);
    const studentById = new Map(students.map((s) => [s.id, s]));

    // KPI + должники
    let totalAmount = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let totalPenalty = 0;
    const debtByStudent = new Map<string, { remaining: number; penalty: number; overdue: number }>();

    for (const inv of invoices) {
      const { remaining, penalty, overdueDays } = computePenalty(inv);
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      totalAmount += inv.amount;
      totalPaid += paid;
      totalRemaining += remaining;
      totalPenalty += penalty;
      if (remaining > 0) {
        const d = debtByStudent.get(inv.studentId) ?? { remaining: 0, penalty: 0, overdue: 0 };
        d.remaining += remaining;
        d.penalty += penalty;
        d.overdue = Math.max(d.overdue, overdueDays);
        debtByStudent.set(inv.studentId, d);
      }
    }

    const debtors = Array.from(debtByStudent.entries())
      .map(([studentId, d]) => {
        const s = studentById.get(studentId);
        return {
          studentId,
          name: s ? `${s.lastName} ${s.firstName}` : '—',
          className: s?.class ? `${s.class.grade}${s.class.letter}` : '—',
          remaining: d.remaining,
          penalty: d.penalty,
          overdueDays: d.overdue,
        };
      })
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 10);

    // Динамика платежей по месяцам (последние 6)
    const months: { key: string; label: string; paid: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('ru-RU', { month: 'short' }),
        paid: 0,
      });
    }
    const monthByKey = new Map(months.map((m) => [m.key, m]));
    for (const inv of invoices) {
      for (const p of inv.payments) {
        const d = new Date(p.paidAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const m = monthByKey.get(key);
        if (m) m.paid += p.amount;
      }
    }

    return successResponse({
      totalAmount,
      totalPaid,
      totalRemaining,
      totalPenalty,
      totalExpenses: expenses._sum.amount ?? 0,
      collectRate: totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 1000) / 10 : 0,
      debtorsCount: debtByStudent.size,
      debtors,
      monthly: months.map(({ label, paid }) => ({ month: label, paid })),
    });
  } catch (error) {
    console.error('GET /api/v1/finance/summary error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить финансовую сводку', 500);
  }
}
