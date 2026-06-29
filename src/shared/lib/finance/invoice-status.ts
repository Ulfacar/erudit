import type { InvoiceStatus, Prisma } from '@prisma/client';

export const INV_STATUS = [
  { value: 'pending', label: 'Ожидает' },
  { value: 'partial', label: 'Частично' },
  { value: 'paid', label: 'Оплачен' },
  { value: 'cancelled', label: 'Отменён' },
];

export const INV_COLOR: Record<string, string> = {
  pending: 'orange',
  partial: 'yellow',
  paid: 'green',
  cancelled: 'gray',
};

export function invoiceStatusLabel(status: string): string {
  return INV_STATUS.find((s) => s.value === status)?.label ?? status;
}

export function verifiedPaidTotal(payments: Array<{ amount: number; verified: boolean }>): number {
  return payments.reduce((sum, payment) => sum + (payment.verified ? payment.amount : 0), 0);
}

export function invoiceStatusFromVerifiedPaid(amount: number, paidVerified: number): InvoiceStatus {
  if (paidVerified >= amount) return 'paid';
  if (paidVerified > 0) return 'partial';
  return 'pending';
}

export async function recalculateFeeInvoiceStatus(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.feeInvoice.findUnique({
    where: { id: invoiceId },
    select: {
      amount: true,
      status: true,
      payments: { select: { amount: true, verified: true } },
    },
  });
  if (!invoice || invoice.status === 'cancelled') return invoice;

  const paidVerified = verifiedPaidTotal(invoice.payments);
  return tx.feeInvoice.update({
    where: { id: invoiceId },
    data: { status: invoiceStatusFromVerifiedPaid(invoice.amount, paidVerified) },
  });
}
