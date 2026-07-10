'use client';

import { useEffect, useState } from 'react';
import { Badge, Group, Loader, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBox } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['uniform_manager', 'super_admin'] as const;

type Item = { id: string; name: string; category: string | null };
type Variant = { id: string; size: string; total: number; available: number };
type StockRow = { id: string; itemName: string; category: string | null; size: string; total: number; available: number };

function UniformStockContent() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const itemsJson = await fetch('/api/v1/uniform/items').then((r) => r.json());
        if (!itemsJson.success) throw new Error(itemsJson.error?.message ?? 'Не удалось загрузить каталог');
        const items = (itemsJson.data ?? []) as Item[];
        const stock = await Promise.all(
          items.map(async (item) => {
            const variantsJson = await fetch(`/api/v1/uniform/items/${item.id}/variants`).then((r) => r.json());
            const variants = (variantsJson.success ? variantsJson.data ?? [] : []) as Variant[];
            return variants.map((variant) => ({
              id: variant.id,
              itemName: item.name,
              category: item.category,
              size: variant.size,
              total: variant.total,
              available: variant.available,
            }));
          }),
        );
        setRows(stock.flat());
      } catch (error) {
        notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось загрузить остатки' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Stack gap="md">
      <Group gap="xs">
        <IconBox size={24} color="#e8590c" />
        <Title order={3}>Остатки формы и мерча</Title>
        <Badge variant="light" color="gray" radius="sm">{rows.length}</Badge>
      </Group>

      <Paper withBorder radius="sm">
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : rows.length === 0 ? (
          <Text c="dimmed" ta="center" p="xl">Остатков пока нет.</Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Товар</Table.Th>
                <Table.Th>Категория</Table.Th>
                <Table.Th>Размер</Table.Th>
                <Table.Th>Осталось</Table.Th>
                <Table.Th>Всего пришло</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.itemName}</Table.Td>
                  <Table.Td>{row.category === 'merch' ? 'Мерч' : 'Форма'}</Table.Td>
                  <Table.Td>{row.size}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={row.available > 0 ? 'green' : 'red'} radius="sm">
                      {row.available}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{row.total}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

export default function UniformStockPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <UniformStockContent />
    </RoleGate>
  );
}
