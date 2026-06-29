import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { computePenalty } from '@/shared/lib/finance/penalty';

/**
 * GET /api/v1/finance/forecast — прогноз прихода («дезографы»): ожидаемые поступления
 * по месяцам из неоплаченных счетов (по сроку оплаты) + «мягкий» сигнал от обещаний
 * колл-центра. Помогает предиктить, сколько денег придёт в этом месяце.
 */
const ROLES = ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'] as const;

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  try {
    const invoices = await prisma.feeInvoice.findMany({
      where: { status: { in: ['pending', 'partial'] }, dueDate: { not: null } },
      include: { payments: { select: { amount: true, verified: true } } },
    });

    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = (d: Date) => d.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });

    const buckets = new Map<string, { label: string; expected: number; overdue: number }>();
    const now = new Date();
    for (const inv of invoices) {
      const { remaining } = computePenalty(inv);
      if (remaining <= 0 || !inv.dueDate) continue;
      const d = new Date(inv.dueDate);
      const key = monthKey(d);
      const b = buckets.get(key) ?? { label: monthLabel(d), expected: 0, overdue: 0 };
      b.expected += remaining;
      if (d < now) b.overdue += remaining;
      buckets.set(key, b);
    }

    // обещания колл-центра за последние 14 дней — «мягкий» ожидаемый приход
    const since = new Date(Date.now() - 14 * 864e5);
    const promiseCount = await prisma.studentNote.count({ where: { type: 'promise', createdAt: { gte: since } } });

    const months = [...buckets.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
    const totalExpected = months.reduce((s, m) => s + m.expected, 0);
    const totalOverdue = months.reduce((s, m) => s + m.overdue, 0);

    return successResponse({ months, totalExpected, totalOverdue, activePromises: promiseCount });
  } catch (e) {
    console.error('GET finance/forecast error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось построить прогноз', 500);
  }
}
