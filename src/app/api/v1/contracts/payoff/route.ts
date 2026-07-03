import { type NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { recalculateFeeInvoiceStatus, verifiedPaidTotal } from '@/shared/lib/finance/invoice-status';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'] as const;

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const contractId = body.contractId ? String(body.contractId) : null;
  const method = body.method ? String(body.method) : null;
  const note = body.note ? String(body.note) : null;
  const invoiceIds = Array.isArray(body.invoiceIds) ? body.invoiceIds.map((id: unknown) => String(id)).filter(Boolean) : null;
  if (!contractId) return errorResponse('VALIDATION_ERROR', 'Не указан договор');

  try {
    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) return errorResponse('NOT_FOUND', 'Договор не найден', 404);

    const open = await prisma.feeInvoice.findMany({
      where: {
        contractId,
        status: { in: ['pending', 'partial'] },
        ...(invoiceIds?.length ? { id: { in: invoiceIds } } : {}),
      },
      include: { payments: { select: { amount: true, verified: true } } },
      orderBy: { dueDate: 'asc' },
    });
    if (!open.length) return errorResponse('VALIDATION_ERROR', 'Нет непогашенных счетов');

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let total = 0;
      let paid = 0;

      for (const inv of open) {
        const rem = inv.amount - verifiedPaidTotal(inv.payments);
        if (rem <= 0) continue;
        await tx.payment.create({
          data: {
            invoiceId: inv.id,
            amount: rem,
            method,
            note: note ?? `Досрочное погашение договора №${contract.number}`,
            recordedBy: auth.session.user.id,
            verified: true,
            verifiedBy: auth.session.user.id,
            verifiedAt: now,
          },
        });
        await recalculateFeeInvoiceStatus(tx, inv.id);
        total += rem;
        paid += 1;
      }

      await tx.studentNote.create({
        data: {
          studentId: contract.studentId,
          authorId: auth.session.user.id,
          role: auth.session.user.role,
          type: 'finance',
          text: `Досрочное погашение: ${paid} счетов, ${total} сом (${method})`,
          meta: { contractId, invoiceIds: open.map((inv) => inv.id), total, invoicesPaid: paid },
        },
      });

      return { total, invoicesPaid: paid };
    });

    return successResponse(result);
  } catch (error) {
    console.error('POST /api/v1/contracts/payoff error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось выполнить досрочное погашение', 500);
  }
}
