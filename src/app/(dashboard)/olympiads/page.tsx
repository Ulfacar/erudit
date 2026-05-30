'use client';

import { Badge } from '@mantine/core';
import { IconAward } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, subjectField, subjectLookup } from '@/shared/components/ui/resource-helpers';

const LEVELS = [
  { value: 'school', label: 'Школьный' },
  { value: 'district', label: 'Районный' },
  { value: 'city', label: 'Городской' },
  { value: 'republic', label: 'Республиканский' },
  { value: 'international', label: 'Международный' },
];

export default function OlympiadsPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'secretary', 'specialist', 'student', 'parent']}>
      <ResourcePage
        title="Олимпиады и проекты"
        icon={<IconAward size={22} color="#e8590c" />}
        endpoint="/api/v1/olympiads"
        createLabel="Добавить олимпиаду"
        canDelete
        lookups={[subjectLookup]}
        columns={[
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date), width: 110 },
          { key: 'name', label: 'Название' },
          { key: 'subjectId', label: 'Предмет', render: (r, m) => (r.subjectId ? m.subjects?.[String(r.subjectId)] ?? '—' : '—') },
          { key: 'level', label: 'Уровень', render: (r) => <Badge variant="light" color="orange" radius="sm">{LEVELS.find((l) => l.value === r.level)?.label ?? String(r.level)}</Badge> },
          { key: 'stage', label: 'Этап' },
        ]}
        fields={[
          { name: 'name', label: 'Название', type: 'text', required: true },
          subjectField,
          { name: 'level', label: 'Уровень', type: 'select', options: LEVELS, defaultValue: 'school' },
          { name: 'stage', label: 'Этап', type: 'text', placeholder: 'отборочный / финал' },
          { name: 'date', label: 'Дата', type: 'date', required: true },
        ]}
      />
    </RoleGate>
  );
}
