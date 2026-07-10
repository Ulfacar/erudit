import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

interface RecordUniformPaymentInput {
  issueId: string;
  studentId: string;
  itemName: string;
  size: string;
  amount: number;
  recordedBy: string;
  method?: string | null;
}

export async function recordUniformPayment(
  tx: Tx,
  { issueId, studentId, itemName, size, amount, recordedBy, method }: RecordUniformPaymentInput,
) {
  const invoice = await tx.feeInvoice.create({
    data: {
      studentId,
      title: `Форма: ${itemName} ${size}`,
      amount,
      status: 'paid',
    },
  });

  const payment = await tx.payment.create({
    data: {
      invoiceId: invoice.id,
      amount,
      method: method ?? 'наличные',
      verified: true,
      verifiedBy: recordedBy,
      verifiedAt: new Date(),
      recordedBy,
    },
  });

  await tx.uniformIssue.update({
    where: { id: issueId },
    data: {
      invoiceId: invoice.id,
      paymentId: payment.id,
    },
  });

  return { invoice, payment };
}
