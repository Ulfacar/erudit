import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { recalculateFeeInvoiceStatus } from '@/shared/lib/finance/invoice-status';

/**
 * Регистрация платежа по счёту. Транзакционно: платёж + пересчёт статуса счёта
 * (pending → partial → paid по сумме платежей).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager', 'call_center'] });
    if (auth.response) return auth.response;

    const body = await request.json();
    const invoiceId = String(body.invoiceId ?? '');
    const amount = parseInt(String(body.amount), 10);
    const method = body.method ? String(body.method) : null;
    const note = body.note ? String(body.note) : null;
    // Платёж от бухгалтера/админа сразу верифицирован; от колл-центра — «со слов» (ждёт подтверждения).
    const role = auth.session.user.role;
    const preVerified = role !== 'call_center';

    if (!invoiceId) return errorResponse('VALIDATION_ERROR', 'Не указан счёт');
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse('VALIDATION_ERROR', 'Сумма должна быть больше нуля');

    const invoice = await prisma.feeInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) return errorResponse('NOT_FOUND', 'Счёт не найден', 404);
    if (invoice.status === 'cancelled') return errorResponse('VALIDATION_ERROR', 'Счёт отменён');

    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId, amount, method, note,
          recordedBy: auth.session.user.id,
          verified: preVerified,
          verifiedBy: preVerified ? auth.session.user.id : null,
          verifiedAt: preVerified ? new Date() : null,
        },
      });
      await recalculateFeeInvoiceStatus(tx, invoiceId);
      return tx.feeInvoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: { payments: { select: { amount: true, paidAt: true, method: true, verified: true } } },
      });
    });

    return successResponse(updated, 201);
  } catch (error) {
    console.error('POST /api/v1/payments error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось зарегистрировать платёж', 500);
  }
}
