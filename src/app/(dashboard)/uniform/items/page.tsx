'use client';

import Link from 'next/link';
import { Badge, Button } from '@mantine/core';
import { IconHanger2, IconListDetails } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';

const ROLES = ['uniform_manager', 'super_admin'] as const;

const CATEGORY_OPTIONS = [
  { value: 'uniform', label: 'Форма' },
  { value: 'merch', label: 'Мерч' },
];

function categoryLabel(value: unknown) {
  return CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? String(value ?? '—');
}

export default function UniformItemsPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <ResourcePage
        title="Каталог формы и мерча"
        icon={<IconHanger2 size={22} color="#e8590c" />}
        endpoint="/api/v1/uniform/items"
        createLabel="Добавить товар"
        canDelete
        searchable
        columns={[
          { key: 'name', label: 'Товар' },
          {
            key: 'category',
            label: 'Категория',
            render: (row) => (
              <Badge variant="light" color={row.category === 'merch' ? 'orange' : 'blue'} radius="sm">
                {categoryLabel(row.category)}
              </Badge>
            ),
          },
          { key: 'basic', label: 'Базовый набор', render: (row) => (row.basic ? 'Да' : 'Нет') },
          { key: 'price', label: 'Цена, сом', render: (row) => String(row.price ?? 0) },
        ]}
        fields={[
          { name: 'name', label: 'Название', type: 'text', required: true },
          { name: 'category', label: 'Категория', type: 'select', options: CATEGORY_OPTIONS, defaultValue: 'uniform' },
          { name: 'basic', label: 'Входит в базовый набор', type: 'switch', defaultValue: false },
          { name: 'price', label: 'Цена доп/платной покупки, сом', type: 'number', defaultValue: 0 },
        ]}
        rowActions={(row) => (
          <Button
            component={Link}
            href={`/uniform/items/${row.id}`}
            size="compact-xs"
            variant="light"
            leftSection={<IconListDetails size={14} />}
          >
            Размеры/приход
          </Button>
        )}
      />
    </RoleGate>
  );
}
