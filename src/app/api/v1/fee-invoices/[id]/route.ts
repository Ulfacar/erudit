import { createCrudId } from '@/shared/lib/crud';

// Редактирование/удаление счёта по id (PUT принимает ISO-даты — клиент конвертирует).
// GET намеренно НЕ экспортируем: createCrudId.GET пускает любого авторизованного,
// а счёт по id не должен читаться родителем/учеником чужого ребёнка (RBAC-паттерн).
const handlers = createCrudId({
  model: 'feeInvoice',
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager'],
  include: { payments: { select: { amount: true } } },
});

export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
