'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconArrowLeft, IconPackageImport, IconTag } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['uniform_manager', 'super_admin'] as const;

type Item = { id: string; name: string; category: string | null; categoryId: string | null; basic: boolean; price: number | null };
type Variant = { id: string; size: string; total: number; available: number };
type UniformCategory = { id: string; name: string };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить данные');
  return json.data;
}

function UniformItemStockContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [item, setItem] = useState<Item | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [submitting, setSubmitting] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);

  const categoriesQuery = useQuery<UniformCategory[]>({
    queryKey: ['uniform-categories'],
    queryFn: () => fetchJson<UniformCategory[]>('/api/v1/uniform/categories'),
  });

  const categoryOptions = useMemo(
    () => (categoriesQuery.data ?? []).map((category) => ({ value: category.id, label: category.name })),
    [categoriesQuery.data],
  );

  const currentCategoryName = useMemo(() => {
    if (!item?.categoryId) return 'Не выбрана';
    return categoriesQuery.data?.find((category) => category.id === item.categoryId)?.name ?? 'Не выбрана';
  }, [categoriesQuery.data, item?.categoryId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemRes, variantsRes] = await Promise.all([
        fetch(`/api/v1/uniform/items/${id}`).then((r) => r.json()),
        fetch(`/api/v1/uniform/items/${id}/variants`).then((r) => r.json()),
      ]);
      if (itemRes.success) setItem(itemRes.data);
      if (variantsRes.success) setVariants(variantsRes.data ?? []);
      if (!itemRes.success || !variantsRes.success) {
        notifications.show({ color: 'red', title: 'Ошибка', message: 'Не удалось загрузить товар' });
      }
    } catch {
      notifications.show({ color: 'red', title: 'Ошибка сети', message: 'Не удалось загрузить товар' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateCategory(categoryId: string | null) {
    if (!item || categorySaving || item.categoryId === categoryId) return;
    setCategorySaving(true);
    try {
      const res = await fetch(`/api/v1/uniform/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось обновить категорию');
      await queryClient.invalidateQueries({ queryKey: ['uniform-item', id] });
      await load();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось обновить категорию',
      });
    } finally {
      setCategorySaving(false);
    }
  }

  async function submit() {
    const qty = Number(quantity);
    if (!size.trim() || !Number.isInteger(qty) || qty <= 0) {
      notifications.show({ color: 'red', title: 'Ошибка', message: 'Укажите размер и положительное количество' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/uniform/items/${id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: size.trim(), quantity: qty }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось принять товар');
      setSize('');
      setQuantity(1);
      notifications.show({ color: 'green', title: 'Готово', message: 'Приход добавлен' });
      load();
    } catch (error) {
      notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось принять товар' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="sm">
          <Button component={Link} href="/uniform/items" variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />}>
            Назад
          </Button>
          <Title order={3}>{item?.name ?? 'Товар'}</Title>
        </Group>
      </Group>

      <Paper withBorder radius="sm" p="md">
        <Group align="flex-end" justify="space-between" gap="md" wrap="wrap">
          <Group gap="sm">
            <IconTag size={20} color="#e8590c" />
            <div>
              <Text fw={600}>Категория</Text>
              <Group gap="xs" mt={4}>
                <Text size="sm" c="dimmed">Текущее значение:</Text>
                <Badge variant="light" color={item?.categoryId ? 'orange' : 'gray'} radius="sm">
                  {currentCategoryName}
                </Badge>
              </Group>
            </div>
          </Group>
          <Select
            data={categoryOptions}
            value={item?.categoryId ?? null}
            onChange={(value) => void updateCategory(value)}
            placeholder="Выберите категорию"
            searchable
            clearable
            disabled={!item || loading || categorySaving}
            rightSection={categoriesQuery.isLoading || categorySaving ? <Loader size="xs" /> : undefined}
            w={{ base: '100%', sm: 320 }}
          />
        </Group>
      </Paper>

      <Paper withBorder radius="sm" p="md">
        <Group align="flex-end">
          <TextInput label="Размер" placeholder="S, M, L, XL, 2XL" value={size} onChange={(e) => setSize(e.currentTarget.value)} />
          <NumberInput label="Количество" min={1} allowDecimal={false} value={quantity} onChange={setQuantity} />
          <Button leftSection={<IconPackageImport size={16} />} onClick={submit} loading={submitting}>
            Добавить приход
          </Button>
        </Group>
      </Paper>

      <Paper withBorder radius="sm">
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : variants.length === 0 ? (
          <Text c="dimmed" ta="center" p="xl">Размеры пока не заведены.</Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Размер</Table.Th>
                <Table.Th>Всего</Table.Th>
                <Table.Th>Осталось</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {variants.map((variant) => (
                <Table.Tr key={variant.id}>
                  <Table.Td>{variant.size}</Table.Td>
                  <Table.Td>{variant.total}</Table.Td>
                  <Table.Td>{variant.available}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

export default function UniformItemStockPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <UniformItemStockContent />
    </RoleGate>
  );
}
