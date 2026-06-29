import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { verifiedPaidTotal } from '@/shared/lib/finance/invoice-status';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager', 'secretary'] as const;

/**
 * POST /api/v1/fee-invoices/carry — перенос недоплаченного остатка счёта.
 * body: { invoiceId, mode: 'next' | 'spread', reason? }
 * Текущий счёт «закрывается» по фактически оплаченному, а недоплата либо целиком
 * переносится на следующий счёт договора ('next'), либо равномерно распределяется
 * по всем последующим ('spread'). Причина недоплаты пишется в ленту ученика.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const invoiceId = body.invoiceId ? String(body.invoiceId) : null;
  const mode = body.mode === 'spread' ? 'spread' : 'next';
  const reason = body.reason ? String(body.reason).trim() : null;
  if (!invoiceId) return errorResponse('VALIDATION_ERROR', 'Не указан счёт');

  try {
    const invoice = await prisma.feeInvoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { select: { amount: true, verified: true } } },
    });
    if (!invoice) return errorResponse('NOT_FOUND', 'Счёт не найден', 404);
    if (!invoice.contractId) return errorResponse('VALIDATION_ERROR', 'Счёт не привязан к договору');

    const paid = verifiedPaidTotal(invoice.payments);
    const shortfall = invoice.amount - paid;
    if (shortfall <= 0) return errorResponse('VALIDATION_ERROR', 'По счёту нет недоплаты');

    // последующие счета этого договора (по сроку оплаты), не отменённые
    const later = await prisma.feeInvoice.findMany({
      where: {
        contractId: invoice.contractId,
        id: { not: invoice.id },
        status: { not: 'cancelled' },
        dueDate: invoice.dueDate ? { gt: invoice.dueDate } : undefined,
      },
      orderBy: { dueDate: 'asc' },
    });
    if (later.length === 0) return errorResponse('VALIDATION_ERROR', 'Нет следующих платежей для переноса остатка');

    await prisma.$transaction(async (tx) => {
      // текущий счёт закрываем по факту оплаты
      await tx.feeInvoice.update({ where: { id: invoice.id }, data: { amount: paid, status: 'paid' } });

      if (mode === 'next') {
        await tx.feeInvoice.update({ where: { id: later[0].id }, data: { amount: later[0].amount + shortfall } });
      } else {
        const per = Math.floor(shortfall / later.length);
        let rem = shortfall - per * later.length; // остаток от деления — на первые счета
        for (const inv of later) {
          const add = per + (rem > 0 ? 1 : 0);
          if (rem > 0) rem -= 1;
          await tx.feeInvoice.update({ where: { id: inv.id }, data: { amount: inv.amount + add } });
        }
      }

      await tx.studentNote.create({
        data: {
          studentId: invoice.studentId,
          authorId: auth.session.user.id,
          role: auth.session.user.role,
          type: 'finance',
          text: reason
            ? `Перенос остатка ${shortfall.toLocaleString('ru-RU')} сом (${mode === 'next' ? 'на след. месяц' : 'распределён по графику'}): ${reason}`
            : `Перенос остатка ${shortfall.toLocaleString('ru-RU')} сом (${mode === 'next' ? 'на след. месяц' : 'распределён по графику'})`,
          meta: { invoiceId: invoice.id, shortfall, mode },
        },
      });
    });

    return successResponse({ shortfall, mode });
  } catch (e) {
    console.error('POST fee-invoices/carry error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось перенести остаток', 500);
  }
}
