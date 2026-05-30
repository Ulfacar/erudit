'use client';

import { IconPalette } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';

export default function StudiosPage() {
  return (
    <RoleGate>
      <ResourcePage
        title="Студии и кружки"
        icon={<IconPalette size={22} color="#12b886" />}
        endpoint="/api/v1/studios"
        createLabel="Добавить студию"
        canDelete
        columns={[
          { key: 'name', label: 'Название' },
          { key: 'leaderName', label: 'Руководитель' },
          { key: 'schedule', label: 'Расписание' },
          { key: 'capacity', label: 'Мест' },
        ]}
        fields={[
          { name: 'name', label: 'Название', type: 'text', required: true },
          { name: 'leaderName', label: 'Руководитель', type: 'text' },
          { name: 'schedule', label: 'Расписание', type: 'text', placeholder: 'Пн/Ср 15:00' },
          { name: 'capacity', label: 'Количество мест', type: 'number' },
          { name: 'description', label: 'Описание', type: 'textarea' },
        ]}
      />
    </RoleGate>
  );
}
