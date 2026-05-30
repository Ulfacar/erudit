'use client';

import { IconConfetti } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

export default function EventsPage() {
  return (
    <RoleGate>
      <ResourcePage
        title="Мероприятия школы"
        icon={<IconConfetti size={22} color="#e64980" />}
        endpoint="/api/v1/events"
        createLabel="Добавить мероприятие"
        canDelete
        columns={[
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date), width: 110 },
          { key: 'title', label: 'Мероприятие' },
          { key: 'location', label: 'Место' },
          { key: 'description', label: 'Описание', render: (r) => (r.description ? String(r.description).slice(0, 80) : '—') },
        ]}
        fields={[
          { name: 'title', label: 'Название', type: 'text', required: true },
          { name: 'date', label: 'Дата', type: 'date', required: true },
          { name: 'endDate', label: 'Дата окончания', type: 'date' },
          { name: 'location', label: 'Место проведения', type: 'text' },
          { name: 'description', label: 'Описание', type: 'textarea' },
        ]}
      />
    </RoleGate>
  );
}
