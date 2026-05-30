'use client';

import { Badge } from '@mantine/core';
import { IconCalendarEvent } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, classField, classLookup } from '@/shared/components/ui/resource-helpers';

const TYPES = [
  { value: 'event', label: 'Событие' },
  { value: 'holiday', label: 'Каникулы' },
  { value: 'exam', label: 'Экзамен' },
  { value: 'meeting', label: 'Собрание' },
  { value: 'deadline', label: 'Дедлайн' },
];
const TYPE_COLOR: Record<string, string> = { event: 'blue', holiday: 'green', exam: 'red', meeting: 'grape', deadline: 'orange' };

export default function CalendarPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'teacher', 'curator']}>
      <ResourcePage
        title="Школьный календарь"
        icon={<IconCalendarEvent size={22} color="#228be6" />}
        endpoint="/api/v1/calendar"
        createLabel="Добавить событие"
        canDelete
        lookups={[classLookup]}
        columns={[
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date), width: 110 },
          { key: 'title', label: 'Событие' },
          { key: 'type', label: 'Тип', render: (r) => <Badge variant="light" color={TYPE_COLOR[String(r.type)] ?? 'gray'} radius="sm">{TYPES.find((t) => t.value === r.type)?.label ?? String(r.type)}</Badge> },
          { key: 'classId', label: 'Класс', render: (r, m) => (r.classId ? m.classes?.[String(r.classId)] ?? '—' : 'Вся школа') },
        ]}
        fields={[
          { name: 'title', label: 'Название', type: 'text', required: true },
          { name: 'date', label: 'Дата', type: 'date', required: true },
          { name: 'endDate', label: 'Дата окончания', type: 'date' },
          { name: 'type', label: 'Тип', type: 'select', options: TYPES, defaultValue: 'event' },
          { ...classField, label: 'Класс (пусто = вся школа)' },
          { name: 'description', label: 'Описание', type: 'textarea' },
        ]}
      />
    </RoleGate>
  );
}
