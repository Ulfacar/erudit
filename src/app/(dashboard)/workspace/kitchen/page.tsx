'use client';

import { Badge } from '@mantine/core';
import { IconToolsKitchen2 } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate, fmtMoney } from '@/shared/components/ui/resource-helpers';

const MEALS = [
  { value: 'breakfast', label: 'Завтрак' },
  { value: 'lunch', label: 'Обед' },
  { value: 'snack', label: 'Полдник' },
];
const MEAL_COLOR: Record<string, string> = { breakfast: 'yellow', lunch: 'green', snack: 'orange' };

export default function KitchenPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <ResourcePage
        title="Кухня — меню питания"
        icon={<IconToolsKitchen2 size={22} color="#fd7e14" />}
        endpoint="/api/v1/meal-menu"
        createLabel="Добавить блюдо"
        canDelete
        columns={[
          { key: 'date', label: 'Дата', render: (r) => fmtDate(r.date), width: 110 },
          { key: 'meal', label: 'Приём', render: (r) => <Badge variant="light" color={MEAL_COLOR[String(r.meal)] ?? 'gray'} radius="sm">{MEALS.find((m) => m.value === r.meal)?.label ?? String(r.meal)}</Badge> },
          { key: 'dish', label: 'Блюдо' },
          { key: 'calories', label: 'Ккал' },
          { key: 'cost', label: 'Стоимость', render: (r) => fmtMoney(r.cost) },
        ]}
        fields={[
          { name: 'date', label: 'Дата', type: 'date', required: true },
          { name: 'meal', label: 'Приём пищи', type: 'select', options: MEALS, defaultValue: 'lunch', required: true },
          { name: 'dish', label: 'Блюдо', type: 'text', required: true },
          { name: 'calories', label: 'Калорийность', type: 'number' },
          { name: 'cost', label: 'Стоимость (сом)', type: 'number' },
        ]}
      />
    </RoleGate>
  );
}
