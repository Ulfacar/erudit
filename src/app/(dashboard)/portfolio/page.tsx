'use client';

import { Badge } from '@mantine/core';
import { IconFolders } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, studentField, studentLookup } from '@/shared/components/ui/resource-helpers';

const TYPES = [
  { value: 'work', label: 'Работа' },
  { value: 'certificate', label: 'Сертификат' },
  { value: 'project', label: 'Проект' },
  { value: 'reflection', label: 'Рефлексия' },
];

export default function PortfolioPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'secretary']}>
      <ResourcePage
        title="Портфолио учеников"
        icon={<IconFolders size={22} color="#7048e8" />}
        endpoint="/api/v1/portfolio"
        createLabel="Добавить запись"
        canDelete
        lookups={[studentLookup]}
        columns={[
          { key: 'studentId', label: 'Ученик', render: (r, m) => m.students?.[String(r.studentId)] ?? '—' },
          { key: 'type', label: 'Тип', render: (r) => <Badge variant="light" color="violet" radius="sm">{TYPES.find((t) => t.value === r.type)?.label ?? String(r.type)}</Badge> },
          { key: 'title', label: 'Название' },
          { key: 'fileName', label: 'Файл', render: (r) => (r.fileName ? String(r.fileName) : '—') },
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date) },
        ]}
        fields={[
          studentField,
          { name: 'type', label: 'Тип', type: 'select', options: TYPES, defaultValue: 'work' },
          { name: 'title', label: 'Название', type: 'text', required: true },
          { name: 'description', label: 'Описание', type: 'textarea' },
          { name: 'fileName', label: 'Имя файла', type: 'text', placeholder: 'project.pdf' },
          { name: 'date', label: 'Дата', type: 'date', required: true },
        ]}
      />
    </RoleGate>
  );
}
