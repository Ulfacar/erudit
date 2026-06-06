import { createCrud } from '@/shared/lib/crud';

// Счета на оплату обучения. Платежи привязываются через статус (демо-уровень).
// Список — только персонал: родители/ученики ходят через /fee-invoices/mine (row-level scoping).
export const { GET, POST, DELETE } = createCrud({
  model: 'feeInvoice',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'accountant'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'accountant'],
  createFields: ['studentId', 'title', 'period', 'amount', 'status', 'dueDate'],
  dateFields: ['dueDate'],
  intFields: ['amount'],
  include: { payments: { select: { amount: true } } }, // для расчёта пени на клиенте
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status', 'studentId'],
});
