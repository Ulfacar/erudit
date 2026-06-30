'use client';

import { Badge } from '@mantine/core';
import { IconRun } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, studentField, studentLookup } from '@/shared/components/ui/resource-helpers';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'] as const;

const EXERCISES = [
  { value: '100m', label: 'Бег 100 м' },
  { value: 'long_jump', label: 'Прыжок в длину' },
  { value: 'pull_ups', label: 'Подтягивания' },
  { value: 'sit_ups', label: 'Пресс' },
  { value: 'shuttle_run', label: 'Челночный бег' },
  { value: 'other', label: 'Другое' },
];

export default function PhysNormsPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <ResourcePage
        title="Нормативы (физ-ра)"
        icon={<IconRun size={22} color="#0c8599" />}
        endpoint="/api/v1/phys-norms"
        createLabel="Добавить норматив"
        canDelete
        searchable
        lookups={[studentLookup]}
        columns={[
          { key: 'studentId', label: 'Ученик', render: (r, m) => m.students?.[String(r.studentId)] ?? '—' },
          { key: 'exercise', label: 'Упражнение', render: (r) => EXERCISES.find((e) => e.value === r.exercise)?.label ?? String(r.exercise ?? '—') },
          { key: 'result', label: 'Результат' },
          { key: 'grade', label: 'Оценка', render: (r) => r.grade ? <Badge variant="light" color="cyan">{String(r.grade)}</Badge> : '—' },
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date) },
        ]}
        fields={[
          studentField,
          { name: 'exercise', label: 'Упражнение', type: 'select', required: true, searchable: true, options: EXERCISES, defaultValue: '100m' },
          { name: 'result', label: 'Результат', type: 'text', required: true, placeholder: '14.2 сек / 12 раз' },
          { name: 'grade', label: 'Оценка / уровень', type: 'text', placeholder: '5 / золото / норма' },
          { name: 'date', label: 'Дата', type: 'date', required: true },
        ]}
      />
    </RoleGate>
  );
}
