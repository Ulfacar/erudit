'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Group, Loader, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { IconReportMoney, IconCheck } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { fmtDate } from '@/shared/components/ui/resource-helpers';
import { useRole } from '@/shared/hooks/useRole';

interface Row { id: string; amount: number; method: string | null; paidAt: string; verified: boolean; studentName: string; branch: string; title: string }
interface Journal { byMethod: { method: string; count: number; total: number }[]; payments: Row[]; unverifiedCount: number }

const fmt = (n: number) => `${n.toLocaleString('ru-RU')} сом`;
const METHOD_LABEL: Record<string, string> = { нал: 'Наличные', карта: 'Карта', мбанк: 'МБанк', банк: 'Банк' };

function Journal() {
  const { has } = useRole();
  const [d, setD] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/v1/finance/journal').then((r) => r.json()).catch(() => ({ data: null }));
    setD(j.data ?? null); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function verify(id: string) {
    await fetch(`/api/v1/payments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verified: true }) });
    load();
  }

  const canVerify = has('super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager');

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;
  if (!d) return <Stack p="md"><Text c="red">Нет данных.</Text></Stack>;

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconReportMoney size={26} color="#2f9e44" /><Title order={2}>Журнал оплат</Title></Group>

      <div>
        <Text size="sm" fw={500} mb="xs">Разбивка по способам оплаты</Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          {d.byMethod.map((m) => (
            <Paper key={m.method} withBorder p="md" radius="md">
              <Text size="xs" c="dimmed">{METHOD_LABEL[m.method] ?? m.method}</Text>
              <Text size="lg" fw={700}>{fmt(m.total)}</Text>
              <Text size="xs" c="dimmed">{m.count} платеж.</Text>
            </Paper>
          ))}
        </SimpleGrid>
      </div>

      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" mb="sm">
          <Title order={5}>Платежи (последние)</Title>
          {d.unverifiedCount > 0 && <Badge color="orange">На подтверждении: {d.unverifiedCount}</Badge>}
        </Group>
        <Table highlightOnHover>
          <Table.Thead><Table.Tr>
            <Table.Th>Дата</Table.Th><Table.Th>Ученик</Table.Th><Table.Th>Филиал</Table.Th><Table.Th>Способ</Table.Th><Table.Th>Сумма</Table.Th><Table.Th>Статус</Table.Th><Table.Th></Table.Th>
          </Table.Tr></Table.Thead>
          <Table.Tbody>
            {d.payments.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>{fmtDate(p.paidAt)}</Table.Td>
                <Table.Td>{p.studentName}</Table.Td>
                <Table.Td>{p.branch}</Table.Td>
                <Table.Td>{METHOD_LABEL[p.method ?? ''] ?? p.method ?? '—'}</Table.Td>
                <Table.Td>{fmt(p.amount)}</Table.Td>
                <Table.Td>{p.verified ? <Badge color="green" leftSection={<IconCheck size={12} />}>Подтверждён</Badge> : <Badge color="orange">Со слов</Badge>}</Table.Td>
                <Table.Td>{!p.verified && canVerify && <Button size="compact-xs" variant="light" color="green" onClick={() => verify(p.id)}>Подтвердить</Button>}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}

export default function JournalPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'accountant', 'chief_accountant', 'finance_manager']}>
      <Journal />
    </RoleGate>
  );
}
