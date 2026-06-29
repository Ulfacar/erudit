'use client';

import {
  Badge,
  Center,
  Grid,
  Group,
  Loader,
  Paper,
  RingProgress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconCash,
  IconCheck,
  IconCoins,
  IconReceipt,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { ForecastCard } from './ForecastCard';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface Debtor {
  studentId: string;
  name: string;
  className: string;
  remaining: number;
  penalty: number;
  overdueDays: number;
}

interface FinanceSummary {
  totalAmount: number;
  totalPaid: number;
  totalRemaining: number;
  totalPenalty: number;
  totalExpenses: number;
  collectRate: number;
  debtorsCount: number;
  debtors: Debtor[];
  monthly: { month: string; paid: number }[];
}

const fmtSom = (n: number) => `${n.toLocaleString('ru-RU')} сом`;

function Kpi({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size={42} radius="md" variant="light" color={color}>{icon}</ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>{label}</Text>
          <Text fw={700} style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }} truncate>{value}</Text>
        </div>
      </Group>
    </Paper>
  );
}

function FinanceContent() {
  const { data, isLoading } = useQuery<FinanceSummary>({
    queryKey: ['finance-summary'],
    queryFn: async () => {
      const res = await fetch('/api/v1/finance/summary');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка');
      return json.data;
    },
  });

  if (isLoading || !data) return <Center h={300}><Loader /></Center>;

  return (
    <Stack gap="lg">
      <div>
        <Title order={2} style={{ letterSpacing: '-0.02em' }}>Финансы школы</Title>
        <Text c="dimmed" size="sm">Сводка для собственника: сборы, задолженность, динамика</Text>
      </div>

      {/* KPI */}
      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md">
        <Kpi label="Начислено" value={fmtSom(data.totalAmount)} color="blue" icon={<IconReceipt size={22} />} />
        <Kpi label="Оплачено" value={fmtSom(data.totalPaid)} color="green" icon={<IconCash size={22} />} />
        <Kpi label="Задолженность" value={fmtSom(data.totalRemaining)} color="orange" icon={<IconCoins size={22} />} />
        <Kpi label="Пени (текущие)" value={data.totalPenalty > 0 ? `+${fmtSom(data.totalPenalty)}` : '—'} color="red" icon={<IconAlertTriangle size={22} />} />
      </SimpleGrid>

      <ForecastCard />

      <Grid gutter="md">
        {/* Собираемость */}
        <Grid.Col span={{ base: 12, lg: 4 }}>
        <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee', height: '100%' }}>
          <Text fw={600} mb="sm">Собираемость</Text>
          <Center>
            <RingProgress
              size={160}
              thickness={14}
              roundCaps
              sections={[{ value: Math.min(data.collectRate, 100), color: data.collectRate >= 80 ? 'green' : data.collectRate >= 50 ? 'yellow' : 'red' }]}
              label={
                <Text ta="center" fw={700} style={{ fontSize: 24 }}>
                  {data.collectRate}%
                </Text>
              }
            />
          </Center>
          <Group justify="space-between" mt="sm">
            <Text size="sm" c="dimmed">Должников</Text>
            <Badge variant="light" color={data.debtorsCount > 0 ? 'orange' : 'green'}>{data.debtorsCount}</Badge>
          </Group>
          <Group justify="space-between" mt={4}>
            <Text size="sm" c="dimmed">Расходы (всего)</Text>
            <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtSom(data.totalExpenses)}</Text>
          </Group>
        </Paper>
        </Grid.Col>

        {/* Динамика платежей */}
        <Grid.Col span={{ base: 12, lg: 8 }}>
        <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee', height: '100%' }}>
          <Text fw={600} mb="sm">Поступления по месяцам</Text>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}к`} width={44} />
              <RechartsTooltip formatter={(v) => [fmtSom(Number(v)), 'Оплачено']} />
              <Bar dataKey="paid" fill="#228be6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
        </Grid.Col>
      </Grid>

      {/* Должники */}
      <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Топ должников</Text>
          <Badge variant="light" color="gray">{data.debtors.length} из {data.debtorsCount}</Badge>
        </Group>
        {data.debtors.length === 0 ? (
          <Group gap="xs" py="md" justify="center">
            <ThemeIcon variant="light" color="teal" radius="xl"><IconCheck size={18} /></ThemeIcon>
            <Text c="dimmed">Задолженностей нет — все счета оплачены.</Text>
          </Group>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ученик</Table.Th>
                <Table.Th>Класс</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Долг</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Пеня</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Просрочка</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.debtors.map((d) => (
                <Table.Tr key={d.studentId}>
                  <Table.Td><Text size="sm" fw={600}>{d.name}</Text></Table.Td>
                  <Table.Td><Badge variant="light" color="blue" radius="sm">{d.className}</Badge></Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <Text size="sm" fw={600} c="orange">{fmtSom(d.remaining)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {d.penalty > 0 ? <Text size="sm" fw={600} c="red">+{fmtSom(d.penalty)}</Text> : <Text size="sm" c="dimmed">—</Text>}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {d.overdueDays > 0 ? <Badge variant="light" color="red" radius="sm">{d.overdueDays} дн</Badge> : <Text size="sm" c="dimmed">—</Text>}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

export default function FinancePage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'accountant', 'chief_accountant', 'finance_manager']}>
      <FinanceContent />
    </RoleGate>
  );
}
