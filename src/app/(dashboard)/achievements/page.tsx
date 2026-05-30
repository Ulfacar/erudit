'use client';

import { Badge } from '@mantine/core';
import { IconTrophy } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, studentField, studentLookup } from '@/shared/components/ui/resource-helpers';

const LEVELS = [
  { value: 'school', label: 'Школьный' },
  { value: 'district', label: 'Районный' },
  { value: 'city', label: 'Городской' },
  { value: 'republic', label: 'Республиканский' },
  { value: 'international', label: 'Международный' },
];
const CATS = [
  { value: 'academic', label: 'Учёба' },
  { value: 'sport', label: 'Спорт' },
  { value: 'art', label: 'Творчество' },
  { value: 'social', label: 'Общественное' },
  { value: 'other', label: 'Другое' },
];

export default function AchievementsPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'secretary']}>
      <ResourcePage
        title="Достижения учеников"
        icon={<IconTrophy size={22} color="#f59f00" />}
        endpoint="/api/v1/achievements"
        createLabel="Добавить достижение"
        canDelete
        lookups={[studentLookup]}
        columns={[
          { key: 'studentId', label: 'Ученик', render: (r, m) => m.students?.[String(r.studentId)] ?? '—' },
          { key: 'title', label: 'Достижение' },
          { key: 'category', label: 'Категория', render: (r) => CATS.find((c) => c.value === r.category)?.label ?? '—' },
          { key: 'level', label: 'Уровень', render: (r) => <Badge variant="light" color="yellow" radius="sm">{LEVELS.find((l) => l.value === r.level)?.label ?? String(r.level)}</Badge> },
          { key: 'place', label: 'Результат' },
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date) },
        ]}
        fields={[
          studentField,
          { name: 'title', label: 'Название', type: 'text', required: true, placeholder: 'Олимпиада по математике' },
          { name: 'category', label: 'Категория', type: 'select', options: CATS, defaultValue: 'academic' },
          { name: 'level', label: 'Уровень', type: 'select', options: LEVELS, defaultValue: 'school' },
          { name: 'place', label: 'Результат', type: 'text', placeholder: '1 место / призёр / участник' },
          { name: 'description', label: 'Описание', type: 'textarea' },
          { name: 'date', label: 'Дата', type: 'date', required: true },
        ]}
      />
    </RoleGate>
  );
}
