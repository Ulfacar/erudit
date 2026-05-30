'use client';

import { Badge, Tabs } from '@mantine/core';
import { IconCash, IconReceipt, IconArrowDownRight } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, fmtMoney, studentField, studentLookup } from '@/shared/components/ui/resource-helpers';

const INV_STATUS = [
  { value: 'pending', label: 'Ожидает' },
  { value: 'partial', label: 'Частично' },
  { value: 'paid', label: 'Оплачен' },
  { value: 'cancelled', label: 'Отменён' },
];
const INV_COLOR: Record<string, string> = { pending: 'orange', partial: 'yellow', paid: 'green', cancelled: 'gray' };

const EXP_CATS = [
  { value: 'salary', label: 'Зарплата' },
  { value: 'utilities', label: 'Коммуналка' },
  { value: 'supplies', label: 'Закуп' },
  { value: 'repair', label: 'Ремонт' },
  { value: 'other', label: 'Прочее' },
];

export default function AccountingPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch']}>
      <Tabs defaultValue="invoices">
        <Tabs.List mb="md">
          <Tabs.Tab value="invoices" leftSection={<IconReceipt size={16} />}>Счета (оплата обучения)</Tabs.Tab>
          <Tabs.Tab value="expenses" leftSection={<IconArrowDownRight size={16} />}>Расходы</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="invoices">
          <ResourcePage
            title="Счета на оплату"
            icon={<IconCash size={22} color="#2f9e44" />}
            endpoint="/api/v1/fee-invoices"
            createLabel="Выставить счёт"
            canDelete
            lookups={[studentLookup]}
            columns={[
              { key: 'studentId', label: 'Ученик', render: (r, m) => m.students?.[String(r.studentId)] ?? '—' },
              { key: 'title', label: 'Назначение' },
              { key: 'period', label: 'Период' },
              { key: 'amount', label: 'Сумма', render: (r) => fmtMoney(r.amount) },
              { key: 'status', label: 'Статус', render: (r) => <Badge variant="light" color={INV_COLOR[String(r.status)] ?? 'gray'} radius="sm">{INV_STATUS.find((s) => s.value === r.status)?.label ?? String(r.status)}</Badge> },
              { key: 'dueDate', label: 'Срок', render: (r) => (r.dueDate ? fmtDate(r.dueDate) : '—') },
            ]}
            fields={[
              studentField,
              { name: 'title', label: 'Назначение', type: 'text', required: true, placeholder: 'Обучение, сентябрь' },
              { name: 'period', label: 'Период', type: 'text', placeholder: 'Сентябрь 2025' },
              { name: 'amount', label: 'Сумма (сом)', type: 'number', required: true },
              { name: 'status', label: 'Статус', type: 'select', options: INV_STATUS, defaultValue: 'pending' },
              { name: 'dueDate', label: 'Срок оплаты', type: 'date' },
            ]}
          />
        </Tabs.Panel>

        <Tabs.Panel value="expenses">
          <ResourcePage
            title="Расходы школы"
            icon={<IconArrowDownRight size={22} color="#e03131" />}
            endpoint="/api/v1/expenses"
            createLabel="Добавить расход"
            canDelete
            columns={[
              { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date), width: 110 },
              { key: 'category', label: 'Категория', render: (r) => EXP_CATS.find((c) => c.value === r.category)?.label ?? String(r.category) },
              { key: 'title', label: 'Назначение' },
              { key: 'amount', label: 'Сумма', render: (r) => fmtMoney(r.amount) },
            ]}
            fields={[
              { name: 'category', label: 'Категория', type: 'select', options: EXP_CATS, defaultValue: 'supplies', required: true },
              { name: 'title', label: 'Назначение', type: 'text', required: true },
              { name: 'amount', label: 'Сумма (сом)', type: 'number', required: true },
              { name: 'date', label: 'Дата', type: 'date', required: true },
            ]}
          />
        </Tabs.Panel>
      </Tabs>
    </RoleGate>
  );
}
