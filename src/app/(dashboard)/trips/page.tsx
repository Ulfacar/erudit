'use client';

import { IconBus } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, fmtMoney, classField, classLookup } from '@/shared/components/ui/resource-helpers';

export default function TripsPage() {
  return (
    <RoleGate>
      <ResourcePage
        title="Выезды и экскурсии"
        icon={<IconBus size={22} color="#1c7ed6" />}
        endpoint="/api/v1/trips"
        createLabel="Добавить выезд"
        canDelete
        lookups={[classLookup]}
        columns={[
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date), width: 110 },
          { key: 'title', label: 'Выезд' },
          { key: 'destination', label: 'Куда' },
          { key: 'classId', label: 'Класс', render: (r, m) => (r.classId ? m.classes?.[String(r.classId)] ?? '—' : '—') },
          { key: 'cost', label: 'Стоимость', render: (r) => fmtMoney(r.cost) },
        ]}
        fields={[
          { name: 'title', label: 'Название', type: 'text', required: true },
          { name: 'destination', label: 'Место назначения', type: 'text' },
          { name: 'date', label: 'Дата', type: 'date', required: true },
          { name: 'returnDate', label: 'Дата возвращения', type: 'date' },
          classField,
          { name: 'cost', label: 'Стоимость (сом)', type: 'number' },
          { name: 'description', label: 'Описание', type: 'textarea' },
        ]}
      />
    </RoleGate>
  );
}
