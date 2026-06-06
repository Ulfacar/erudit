import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * Регистрация платежа по счёту. Транзакционно: платёж + пересчёт статуса счёта
 * (pending → partial → paid по сумме платежей).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'zavuch', 'accountant'] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const invoiceId = String(body.invoiceId ?? '');
    const amount = parseInt(String(body.amount), 10);
    const method = body.method ? String(body.method) : null;
    const note = body.note ? String(body.note) : null;

    if (!invoiceId) return errorResponse('VALIDATION_ERROR', 'Не указан счёт');
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse('VALIDATION_ERROR', 'Сумма должна быть больше нуля');

    const invoice = await prisma.feeInvoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { select: { amount: true } } },
    });
    if (!invoice) return errorResponse('NOT_FOUND', 'Счёт не найден', 404);
    if (invoice.status === 'cancelled') return errorResponse('VALIDATION_ERROR', 'Счёт отменён');

    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.create({ data: { invoiceId, amount, method, note } });
      const paidBefore = invoice.payments.reduce((s, p) => s + p.amount, 0);
      const paidTotal = paidBefore + amount;
      const status = paidTotal >= invoice.amount ? 'paid' : paidTotal > 0 ? 'partial' : 'pending';
      return tx.feeInvoice.update({
        where: { id: invoiceId },
        data: { status },
        include: { payments: { select: { amount: true, paidAt: true, method: true } } },
      });
    });

    return successResponse(updated, 201);
  } catch (error) {
    console.error('POST /api/v1/payments error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось зарегистрировать платёж', 500);
  }
}
