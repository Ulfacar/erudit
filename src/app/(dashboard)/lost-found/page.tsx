'use client';

import { Badge } from '@mantine/core';
import { IconBox } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

const STATUS = [
  { value: 'found', label: 'Найдено' },
  { value: 'claimed', label: 'Заявлено' },
  { value: 'returned', label: 'Возвращено' },
];
const COLOR: Record<string, string> = { found: 'blue', claimed: 'orange', returned: 'green' };

export default function LostFoundPage() {
  return (
    <RoleGate>
      <ResourcePage
        title="Бюро находок"
        icon={<IconBox size={22} color="#1971c2" />}
        endpoint="/api/v1/lost-found"
        createLabel="Добавить находку"
        canDelete
        columns={[
          { key: 'foundAt', label: 'Дата', render: (r) => fmtDate(r.foundAt), width: 110 },
          { key: 'title', label: 'Предмет' },
          { key: 'location', label: 'Где найдено' },
          { key: 'status', label: 'Статус', render: (r) => <Badge variant="light" color={COLOR[String(r.status)] ?? 'gray'} radius="sm">{STATUS.find((s) => s.value === r.status)?.label ?? String(r.status)}</Badge> },
        ]}
        fields={[
          { name: 'title', label: 'Что найдено', type: 'text', required: true },
          { name: 'location', label: 'Где найдено', type: 'text' },
          { name: 'description', label: 'Описание', type: 'textarea' },
          { name: 'status', label: 'Статус', type: 'select', options: STATUS, defaultValue: 'found' },
        ]}
      />
    </RoleGate>
  );
}
