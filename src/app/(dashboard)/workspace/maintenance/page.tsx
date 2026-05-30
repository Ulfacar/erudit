'use client';

import { Badge, Tabs } from '@mantine/core';
import { IconTool, IconClipboardList, IconBox } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';

const PRIORITY = [
  { value: 'high', label: 'Высокий' },
  { value: 'medium', label: 'Средний' },
  { value: 'low', label: 'Низкий' },
];
const STATUS = [
  { value: 'open', label: 'Открыта' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Выполнена' },
  { value: 'cancelled', label: 'Отменена' },
];
const PR_COLOR: Record<string, string> = { high: 'red', medium: 'yellow', low: 'gray' };
const ST_COLOR: Record<string, string> = { open: 'blue', in_progress: 'orange', done: 'green', cancelled: 'gray' };

export default function MaintenancePage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <Tabs defaultValue="requests">
        <Tabs.List mb="md">
          <Tabs.Tab value="requests" leftSection={<IconClipboardList size={16} />}>Заявки</Tabs.Tab>
          <Tabs.Tab value="assets" leftSection={<IconBox size={16} />}>Инвентарь</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="requests">
          <ResourcePage
            title="Заявки АХЧ"
            icon={<IconTool size={22} color="#868e96" />}
            endpoint="/api/v1/maintenance"
            createLabel="Новая заявка"
            canDelete
            columns={[
              { key: 'title', label: 'Заявка' },
              { key: 'location', label: 'Место' },
              { key: 'priority', label: 'Приоритет', render: (r) => <Badge variant="light" color={PR_COLOR[String(r.priority)] ?? 'gray'} radius="sm">{PRIORITY.find((p) => p.value === r.priority)?.label ?? String(r.priority)}</Badge> },
              { key: 'status', label: 'Статус', render: (r) => <Badge variant="light" color={ST_COLOR[String(r.status)] ?? 'gray'} radius="sm">{STATUS.find((s) => s.value === r.status)?.label ?? String(r.status)}</Badge> },
              { key: 'assigneeName', label: 'Исполнитель' },
            ]}
            fields={[
              { name: 'title', label: 'Что требуется', type: 'text', required: true },
              { name: 'location', label: 'Место', type: 'text', placeholder: 'Кабинет 204' },
              { name: 'priority', label: 'Приоритет', type: 'select', options: PRIORITY, defaultValue: 'medium' },
              { name: 'status', label: 'Статус', type: 'select', options: STATUS, defaultValue: 'open' },
              { name: 'assigneeName', label: 'Исполнитель', type: 'text' },
              { name: 'description', label: 'Описание', type: 'textarea' },
            ]}
          />
        </Tabs.Panel>

        <Tabs.Panel value="assets">
          <ResourcePage
            title="Инвентарь и имущество"
            icon={<IconBox size={22} color="#868e96" />}
            endpoint="/api/v1/assets"
            createLabel="Добавить позицию"
            canDelete
            columns={[
              { key: 'name', label: 'Наименование' },
              { key: 'inventoryNo', label: 'Инв. №' },
              { key: 'location', label: 'Место' },
              { key: 'category', label: 'Категория' },
              { key: 'quantity', label: 'Кол-во' },
              { key: 'condition', label: 'Состояние' },
            ]}
            fields={[
              { name: 'name', label: 'Наименование', type: 'text', required: true },
              { name: 'inventoryNo', label: 'Инвентарный номер', type: 'text' },
              { name: 'location', label: 'Место', type: 'text' },
              { name: 'category', label: 'Категория', type: 'text', placeholder: 'мебель / техника / инвентарь' },
              { name: 'quantity', label: 'Количество', type: 'number', defaultValue: 1 },
              { name: 'condition', label: 'Состояние', type: 'text', placeholder: 'рабочее / требует ремонта' },
            ]}
          />
        </Tabs.Panel>
      </Tabs>
    </RoleGate>
  );
}
