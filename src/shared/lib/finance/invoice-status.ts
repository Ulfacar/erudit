/** Статусы счетов — общие маппинги для бухгалтерии, дневника и печатных форм. */

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
