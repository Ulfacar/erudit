import { createCrud } from '@/shared/lib/crud';

// Счета на оплату обучения. Платежи привязываются через статус (демо-уровень).
export const { GET, POST, DELETE } = createCrud({
  model: 'feeInvoice',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'accountant'],
  createFields: ['studentId', 'title', 'period', 'amount', 'status', 'dueDate'],
  dateFields: ['dueDate'],
  intFields: ['amount'],
  include: { payments: { select: { amount: true } } }, // для расчёта пени на клиенте
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status', 'studentId'],
});
