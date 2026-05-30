'use client';

import { Badge } from '@mantine/core';
import { IconBook2 } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';

const CATS = [
  { value: 'textbook', label: 'Учебник' },
  { value: 'fiction', label: 'Художественная' },
  { value: 'method', label: 'Методическая' },
  { value: 'reference', label: 'Справочная' },
];

export default function LibraryPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'secretary']}>
      <ResourcePage
        title="Библиотека"
        icon={<IconBook2 size={22} color="#1098ad" />}
        endpoint="/api/v1/library"
        createLabel="Добавить книгу"
        canDelete
        columns={[
          { key: 'title', label: 'Название' },
          { key: 'author', label: 'Автор' },
          { key: 'category', label: 'Категория', render: (r) => (r.category ? <Badge variant="light" color="cyan" radius="sm">{CATS.find((c) => c.value === r.category)?.label ?? String(r.category)}</Badge> : '—') },
          { key: 'available', label: 'Доступно', render: (r) => `${r.available ?? 0} / ${r.total ?? 0}` },
        ]}
        fields={[
          { name: 'title', label: 'Название', type: 'text', required: true },
          { name: 'author', label: 'Автор', type: 'text' },
          { name: 'isbn', label: 'ISBN', type: 'text' },
          { name: 'category', label: 'Категория', type: 'select', options: CATS, defaultValue: 'textbook' },
          { name: 'total', label: 'Всего экземпляров', type: 'number', defaultValue: 1 },
          { name: 'available', label: 'Доступно', type: 'number', defaultValue: 1 },
        ]}
      />
    </RoleGate>
  );
}
