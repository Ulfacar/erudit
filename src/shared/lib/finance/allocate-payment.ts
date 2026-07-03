import type { Prisma } from '@prisma/client';
import { recalculateFeeInvoiceStatus, verifiedPaidTotal } from '@/shared/lib/finance/invoice-status';

type InvoiceForAllocation = {
  id: string;
  title: string;
  amount: number;
  contractId: string | null;
  dueDate: Date | string | null;
  payments: Array<{ amount: number; verified: boolean }>;
};

interface AllocatePaymentInput {
  amount: number;
  method: string | null;
  note: string | null;
  recordedBy: string;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: Date | null;
}

export interface PaymentAllocation {
  invoiceId: string;
  title: string;
  amount: number;
}

async function createPayment(
  tx: Prisma.TransactionClient,
  invoice: { id: string; title: string },
  input: AllocatePaymentInput,
  amount: number,
  note: string | null,
  allocations: PaymentAllocation[],
) {
  await tx.payment.create({
    data: {
      invoiceId: invoice.id,
      amount,
      method: input.method,
      note,
      recordedBy: input.recordedBy,
      verified: input.verified,
      verifiedBy: input.verifiedBy,
      verifiedAt: input.verifiedAt,
    },
  });
  await recalculateFeeInvoiceStatus(tx, invoice.id);
  allocations.push({ invoiceId: invoice.id, title: invoice.title, amount });
}

export async function allocatePayment(
  tx: Prisma.TransactionClient,
  invoice: InvoiceForAllocation,
  input: AllocatePaymentInput,
): Promise<PaymentAllocation[]> {
  const freshInvoice = await tx.feeInvoice.findUnique({
    where: { id: invoice.id },
    include: { payments: { select: { amount: true, verified: true } } },
  });
  const target = freshInvoice ?? invoice;
  const targetRem = Math.max(0, target.amount - verifiedPaidTotal(target.payments));
  const pay0 = Math.min(input.amount, targetRem);
  let leftover = input.amount - pay0;
  const allocations: PaymentAllocation[] = [];

  const first = targetRem > 0 ? pay0 : input.amount;
  await createPayment(tx, target, input, first, input.note, allocations);
  if (targetRem <= 0) leftover = 0;

  if (targetRem > 0 && leftover > 0 && target.contractId) {
    const later = await tx.feeInvoice.findMany({
      where: {
        contractId: target.contractId,
        id: { not: target.id },
        status: { in: ['pending', 'partial'] },
        ...(target.dueDate ? { dueDate: { gt: target.dueDate } } : {}),
      },
      include: { payments: { select: { amount: true, verified: true } } },
      orderBy: { dueDate: 'asc' },
    });

    const overflowNote = `${input.note ?? ''} · излишек с «${target.title}»`.trim();
    let lastOpen: { id: string; title: string } | null = null;

    for (const inv of later) {
      if (leftover <= 0) break;
      lastOpen = inv;
      const remaining = Math.max(0, inv.amount - verifiedPaidTotal(inv.payments));
      const take = Math.min(leftover, remaining);
      if (take > 0) {
        await createPayment(tx, inv, input, take, overflowNote, allocations);
        leftover -= take;
      }
    }

    if (leftover > 0) {
      const tailTarget = lastOpen ?? target;
      await createPayment(tx, tailTarget, input, leftover, overflowNote, allocations);
    }
  }

  return allocations;
}
