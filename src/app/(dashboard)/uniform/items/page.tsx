'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ActionIcon,
  Badge,
  Button,
  FileInput,
  Group,
  Image,
  Modal,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconHanger2, IconListDetails, IconPhoto, IconTag, IconTrash } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage, type ResourceRow } from '@/shared/components/ui/ResourcePage';

const ROLES = ['uniform_manager', 'super_admin'] as const;

const CATEGORY_OPTIONS = [
  { value: 'uniform', label: 'Форма' },
  { value: 'merch', label: 'Мерч' },
];

type UniformCategory = {
  id: string;
  name: string;
};

type PhotoResponse = {
  url: string;
};

function categoryLabel(value: unknown) {
  return CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? String(value ?? '—');
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить данные');
  return json.data;
}

function CategoryManagerModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categoriesQuery = useQuery<UniformCategory[]>({
    queryKey: ['uniform-categories'],
    queryFn: () => fetchJson<UniformCategory[]>('/api/v1/uniform/categories'),
  });

  async function createCategory() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/uniform/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось добавить категорию');
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['uniform-categories'] });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось добавить категорию',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Удалить категорию?')) return;
    try {
      const res = await fetch(`/api/v1/uniform/categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось удалить категорию');
      await queryClient.invalidateQueries({ queryKey: ['uniform-categories'] });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось удалить категорию',
      });
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Категории товаров" centered>
      <Stack gap="sm">
        <Group align="flex-end" wrap="nowrap">
          <TextInput
            label="Название"
            placeholder="Кепка, футболка, бомбер"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void createCategory();
            }}
            style={{ flex: 1 }}
          />
          <Button onClick={createCategory} loading={submitting} leftSection={<IconTag size={16} />}>
            Добавить
          </Button>
        </Group>

        <Stack gap={6}>
          {(categoriesQuery.data ?? []).map((category) => (
            <Group key={category.id} justify="space-between" wrap="nowrap">
              <Text size="sm">{category.name}</Text>
              <ActionIcon variant="subtle" color="red" onClick={() => void deleteCategory(category.id)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          {!categoriesQuery.isLoading && (categoriesQuery.data ?? []).length === 0 && (
            <Text size="sm" c="dimmed">Категории пока не добавлены.</Text>
          )}
        </Stack>
      </Stack>
    </Modal>
  );
}

function ItemPhotoModal({
  row,
  opened,
  onClose,
  onUploaded,
}: {
  row: ResourceRow | null;
  opened: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setFile(null);
    setPhotoUrl(null);
    setImgError(false);
    if (!opened || !row?.id || !row.imageKey) return;

    fetch(`/api/v1/uniform/items/${row.id}/photo`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setImgError(false);
          setPhotoUrl((json.data as PhotoResponse).url);
        }
      })
      .catch(() => {
        setImgError(true);
        setPhotoUrl(null);
      });
  }, [opened, row]);

  async function uploadPhoto() {
    if (!row?.id || !file) return;
    setUploading(true);
    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const res = await fetch(`/api/v1/uniform/items/${row.id}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить фото');

      notifications.show({ color: 'green', title: 'Готово', message: 'Фото товара обновлено' });
      onUploaded();
      onClose();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось загрузить фото',
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={row ? `Фото — ${row.name ?? 'товар'}` : 'Фото'} centered>
      <Stack gap="sm">
        {photoUrl && !imgError ? (
          <Image
            src={photoUrl}
            alt="Фото товара"
            radius="sm"
            mah={260}
            fit="contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <Group justify="center" py="xl">
            <Stack align="center" gap="xs">
              <ThemeIcon variant="light" color="gray" size={54} radius="xl">
                <IconPhoto size={28} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">Фото пока не загружено.</Text>
            </Stack>
          </Group>
        )}
        <FileInput
          label="Новое фото"
          accept="image/*"
          value={file}
          onChange={setFile}
          leftSection={<IconPhoto size={16} />}
        />
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={uploadPhoto} loading={uploading} disabled={!file}>
            Сохранить фото
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default function UniformItemsPage() {
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [photoRow, setPhotoRow] = useState<ResourceRow | null>(null);
  const [reloadItems, setReloadItems] = useState<(() => void) | null>(null);

  const categoriesQuery = useQuery<UniformCategory[]>({
    queryKey: ['uniform-categories'],
    queryFn: () => fetchJson<UniformCategory[]>('/api/v1/uniform/categories'),
  });

  const categoryOptions = useMemo(
    () => (categoriesQuery.data ?? []).map((category) => ({ value: category.id, label: category.name })),
    [categoriesQuery.data],
  );

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) map.set(category.id, category.name);
    return map;
  }, [categoriesQuery.data]);

  return (
    <RoleGate roles={[...ROLES]}>
      <ResourcePage
        title="Каталог формы и мерча"
        icon={<IconHanger2 size={22} color="#e8590c" />}
        endpoint="/api/v1/uniform/items"
        createLabel="Добавить товар"
        canDelete
        searchable
        headerActions={(
          <Button variant="light" leftSection={<IconTag size={16} />} onClick={() => setCategoriesOpen(true)}>
            Категории
          </Button>
        )}
        columns={[
          { key: 'name', label: 'Товар' },
          {
            key: 'category',
            label: 'Раздел',
            render: (row) => (
              <Badge variant="light" color={row.category === 'merch' ? 'orange' : 'blue'} radius="sm">
                {categoryLabel(row.category)}
              </Badge>
            ),
          },
          {
            key: 'categoryId',
            label: 'Категория',
            render: (row) => row.categoryId ? (categoryMap.get(String(row.categoryId)) ?? '—') : '—',
          },
          { key: 'basic', label: 'Базовый набор', render: (row) => (row.basic ? 'Да' : 'Нет') },
          { key: 'price', label: 'Цена, сом', render: (row) => String(row.price ?? 0) },
        ]}
        fields={[
          { name: 'name', label: 'Название', type: 'text', required: true },
          { name: 'category', label: 'Раздел', type: 'select', options: CATEGORY_OPTIONS, defaultValue: 'uniform' },
          { name: 'categoryId', label: 'Категория', type: 'select', options: categoryOptions, searchable: true },
          { name: 'basic', label: 'Входит в базовый набор', type: 'switch', defaultValue: false },
          { name: 'price', label: 'Цена доп/платной покупки, сом', type: 'number', defaultValue: 0 },
        ]}
        rowActions={(row, reload) => (
          <>
            <Tooltip label="Фото товара">
              <ActionIcon
                variant="light"
                color={row.imageKey ? 'orange' : 'gray'}
                onClick={() => {
                  setReloadItems(() => reload);
                  setPhotoRow(row);
                }}
              >
                <IconPhoto size={16} />
              </ActionIcon>
            </Tooltip>
            <Button
              component={Link}
              href={`/uniform/items/${row.id}`}
              size="compact-xs"
              variant="light"
              leftSection={<IconListDetails size={14} />}
            >
              Размеры/приход
            </Button>
          </>
        )}
      />

      <CategoryManagerModal opened={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <ItemPhotoModal
        row={photoRow}
        opened={Boolean(photoRow)}
        onClose={() => setPhotoRow(null)}
        onUploaded={() => reloadItems?.()}
      />
    </RoleGate>
  );
}
