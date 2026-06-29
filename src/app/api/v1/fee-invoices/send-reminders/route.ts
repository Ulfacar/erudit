import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { computePenalty } from '@/shared/lib/finance/penalty';
import { emitEvent } from '@/shared/lib/agent/engine';

/**
 * Разослать родителям напоминания о просроченных счетах.
 * Без cron: бухгалтер жмёт кнопку → событие invoice.overdue на каждый просроченный счёт
 * → агент создаёт алерты родителям (инбокс + Telegram/пуш, если привязаны).
 * Дедуп открытых напоминаний — внутри правила (hasOpenItem).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'] });
    if (auth.response) return auth.response;

    const invoices = await prisma.feeInvoice.findMany({
      where: { status: { in: ['pending', 'partial'] }, dueDate: { not: null, lt: new Date() } },
      include: { payments: { select: { amount: true, verified: true } } },
    });

    let count = 0;
    for (const inv of invoices) {
      const { remaining, penalty, overdueDays } = computePenalty(inv);
      if (remaining <= 0 || overdueDays <= 0) continue; // льготный период ещё идёт
      await emitEvent('invoice.overdue', {
        actorUserId: null, // системное напоминание — алерт идёт родителю напрямую
        studentId: inv.studentId,
        payload: { invoiceId: inv.id, title: inv.title, remaining, penalty, overdueDays },
      });
      count += 1;
    }

    return successResponse({ count });
  } catch (error) {
    console.error('POST /api/v1/fee-invoices/send-reminders error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось отправить напоминания', 500);
  }
}
