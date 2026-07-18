import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { putObject, dataUrlToBuffer, isStorageConfigured } from '@/shared/lib/storage/minio';
import { recalculateFeeInvoiceStatus } from '@/shared/lib/finance/invoice-status';
import { canAccessStudent } from '@/shared/lib/student-access';

const VERIFY_ROLES = ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'] as const;

/**
 * PATCH /api/v1/payments/[id] — бухгалтер подтверждает реальное поступление денег
 * + опционально прикрепляет чек (base64 → MinIO).
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...VERIFY_ROLES] });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  // Филиальная изоляция: платёж можно менять только по счёту ученика своего филиала.
  // Проверка до любой мутации — update, смены verified, загрузки чека, пересчёта счёта
  // (fail-closed). Заодно даёт штатный NOT_FOUND для несуществующего платежа.
  const existing = await prisma.payment.findUnique({ where: { id }, select: { invoice: { select: { studentId: true } } } });
  if (!existing) return errorResponse('NOT_FOUND', 'Платёж не найден', 404);
  if (!(await canAccessStudent(auth.session.user.role, auth.session.user.id, existing.invoice.studentId, auth.session.user.branchId))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к платежу', 403);
  }

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.verified === true) {
    data.verified = true;
    data.verifiedBy = auth.session.user.id;
    data.verifiedAt = new Date();
  } else if (body.verified === false) {
    data.verified = false; data.verifiedBy = null; data.verifiedAt = null;
  }
  if (typeof body.method === 'string') data.method = body.method;

  // чек (квитанция) в приватное хранилище
  if (typeof body.receiptBase64 === 'string' && isStorageConfigured()) {
    try {
      const { buffer, contentType } = dataUrlToBuffer(body.receiptBase64);
      data.receiptKey = await putObject(`receipts/${id}-${Date.now()}`, buffer, contentType);
    } catch (e) {
      console.error('receipt upload failed:', e);
    }
  }

  if (Object.keys(data).length === 0) return errorResponse('VALIDATION_ERROR', 'Нет полей для обновления');

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({ where: { id }, data });
      await recalculateFeeInvoiceStatus(tx, payment.invoiceId);
      return tx.payment.findUniqueOrThrow({
        where: { id },
        include: { invoice: { select: { id: true, amount: true, status: true } } },
      });
    });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH payments/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить платёж', 500);
  }
}
