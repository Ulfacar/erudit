'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Group, Loader, Paper, ScrollArea, Select, Stack, Table, Text, Title } from '@mantine/core';
import { IconToolsKitchen2 } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useMe } from '@/shared/hooks/useMe';

const SURFACE = '#ffffff';
const BORDER = '#e6e9ee';
const SEC = 'var(--mantine-color-dimmed)';

const MEALS: Record<string, string> = { breakfast: 'Завтрак', lunch: 'Обед', snack: 'Полдник' };

interface MenuItem { id: string; date: string; meal: string; dish: string; cost: number | null }
interface Order { id: string; date: string; meal: string; studentId: string; status: string }

function dayKey(d: string) { return new Date(d).toISOString().slice(0, 10); }
function fmt(d: string) { return new Date(d).toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit', month: '2-digit' }); }

function Meals() {
  const { me } = useMe();
  const isParent = me?.role === 'parent';
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [childId, setChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, o] = await Promise.all([fetch('/api/v1/meal-menu'), fetch('/api/v1/meal-orders')]);
      const mj = await m.json();
      const oj = await o.json();
      if (mj.success) setMenu(mj.data);
      if (oj.success) setOrders(oj.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isParent && me?.children?.length && !childId) setChildId(me.children[0].studentId);
  }, [isParent, me, childId]);

  const activeStudent = isParent ? childId : null;

  const orderedSet = useMemo(() => {
    const s = new Set<string>();
    for (const o of orders) {
      if (o.status !== 'ordered') continue;
      if (isParent && o.studentId !== activeStudent) continue;
      s.add(`${dayKey(o.date)}|${o.meal}`);
    }
    return s;
  }, [orders, isParent, activeStudent]);

  async function toggle(item: MenuItem, ordered: boolean) {
    await fetch('/api/v1/meal-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dayKey(item.date), meal: item.meal, status: ordered ? 'cancelled' : 'ordered', studentId: activeStudent }),
    });
    load();
  }

  // только будущие/сегодняшние даты
  const upcoming = [...menu]
    .filter((m) => new Date(dayKey(m.date)) >= new Date(new Date().toISOString().slice(0, 10)))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap={8}><IconToolsKitchen2 size={22} color="#fd7e14" /><Title order={3} c="var(--mantine-color-text)">Столовая</Title></Group>
        {isParent && (me?.children?.length ?? 0) > 0 && (
          <Select w={240} data={(me?.children ?? []).map((c) => ({ value: c.studentId, label: `${c.lastName} ${c.firstName}` }))}
            value={childId} onChange={setChildId} allowDeselect={false} />
        )}
      </Group>

      <Paper radius="md" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        {loading ? (
          <Group justify="center" p="xl"><Loader color="blue" /></Group>
        ) : upcoming.length === 0 ? (
          <Text c={SEC} ta="center" p="xl">Меню пока не опубликовано</Text>
        ) : (
          <ScrollArea>
            <Table highlightOnHover style={{ minWidth: 560 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ color: SEC, fontSize: 12 }}>Дата</Table.Th>
                  <Table.Th style={{ color: SEC, fontSize: 12 }}>Приём</Table.Th>
                  <Table.Th style={{ color: SEC, fontSize: 12 }}>Блюдо</Table.Th>
                  <Table.Th style={{ color: SEC, fontSize: 12, width: 140 }}>Заказ</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {upcoming.map((m) => {
                  const ordered = orderedSet.has(`${dayKey(m.date)}|${m.meal}`);
                  return (
                    <Table.Tr key={m.id}>
                      <Table.Td><Text size="sm">{fmt(m.date)}</Text></Table.Td>
                      <Table.Td><Badge variant="light" color="orange" radius="sm">{MEALS[m.meal] ?? m.meal}</Badge></Table.Td>
                      <Table.Td><Text size="sm">{m.dish}</Text></Table.Td>
                      <Table.Td>
                        <Button size="xs" variant={ordered ? 'light' : 'filled'} color={ordered ? 'red' : 'green'}
                          onClick={() => toggle(m, ordered)}>
                          {ordered ? 'Отменить' : 'Заказать'}
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>
      <Text size="xs" c={SEC}>Оплата производится в школе — здесь только заказ/отмена.</Text>
    </Stack>
  );
}

export default function MealsPage() {
  return <RoleGate roles={['student', 'parent', 'super_admin', 'analyst', 'zavuch', 'secretary']}><Meals /></RoleGate>;
}
