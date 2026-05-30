'use client';

import { Badge } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

const OWNER_TYPES = [
  { value: 'student', label: 'Ученик' },
  { value: 'teacher', label: 'Педагог' },
  { value: 'staff', label: 'Сотрудник' },
  { value: 'school', label: 'Школа' },
];

export default function DocumentsPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <ResourcePage
        title="Документы"
        icon={<IconFileText size={22} color="#495057" />}
        endpoint="/api/v1/documents"
        createLabel="Добавить документ"
        canDelete
        columns={[
          { key: 'ownerType', label: 'Принадлежность', render: (r) => <Badge variant="light" color="gray" radius="sm">{OWNER_TYPES.find((o) => o.value === r.ownerType)?.label ?? String(r.ownerType)}</Badge> },
          { key: 'kind', label: 'Тип' },
          { key: 'title', label: 'Название' },
          { key: 'number', label: 'Номер' },
          { key: 'expiresAt', label: 'Действует до', render: (r) => (r.expiresAt ? fmtDate(r.expiresAt) : '—') },
        ]}
        fields={[
          { name: 'ownerType', label: 'Принадлежность', type: 'select', options: OWNER_TYPES, defaultValue: 'school', required: true },
          { name: 'kind', label: 'Тип документа', type: 'text', required: true, placeholder: 'Приказ / Договор / СНИЛС' },
          { name: 'title', label: 'Название', type: 'text', required: true },
          { name: 'number', label: 'Номер', type: 'text' },
          { name: 'issuedAt', label: 'Дата выдачи', type: 'date' },
          { name: 'expiresAt', label: 'Действует до', type: 'date' },
          { name: 'fileName', label: 'Имя файла', type: 'text' },
        ]}
      />
    </RoleGate>
  );
}
