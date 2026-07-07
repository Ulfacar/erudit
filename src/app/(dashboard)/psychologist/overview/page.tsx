'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, Group, Loader, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { IconChartBar, IconShieldLock } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface Dash {
  level?: 'own' | 'coordinator' | 'admin';
  total: number;
  byStatus: Record<string, number>;
  byRisk: Record<string, number>;
  riskByGrade: { grade: number; count: number }[];
  dynamics: { casesWithDynamics: number; improved: number; improvedPct: number };
  byPsychologist?: { userId: string; login: string; cases: number; atRisk: number }[];
  ai?: { avg: number | null; count: number };
}
const RISK = { green: { label: 'Зелёный', color: 'green' }, yellow: { label: 'Жёлтый', color: 'yellow' }, red: { label: 'Красный', color: 'red' } } as const;

function Overview() {
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/v1/psy/dashboard').then((r) => r.json()).then((j) => setD(j.data ?? null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;
  if (!d) return <Stack p="md"><Text c="red">Нет доступа или данных.</Text></Stack>;

  const level = d.level ?? 'admin';
  const title = level === 'own' ? 'Моя сводка' : level === 'coordinator' ? 'Сводка по службе' : 'Психологическая служба — сводка';
  const subtitle = level === 'own'
    ? 'Только ваши кейсы.'
    : level === 'coordinator'
      ? 'Общие агрегаты по всем психологам.'
      : 'Анонимно: только агрегаты, без ФИО детей и текстов заключений.';

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconChartBar size={26} color="#1971c2" /><Title order={2}>{title}</Title></Group>
      <Group gap={6}><IconShieldLock size={14} color="#2f9e44" /><Text size="sm" c="dimmed">{subtitle}</Text></Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <StatCard label="Всего кейсов" value={d.total} />
        <StatCard label="В зоне риска" value={(d.byRisk.yellow ?? 0) + (d.byRisk.red ?? 0)} color="orange" />
        <StatCard label="Критических" value={d.byRisk.red ?? 0} color="red" />
        <StatCard label="Положительная динамика" value={`${d.dynamics.improvedPct}%`} color="teal" />
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="xs">Кейсы в зоне риска по параллелям</Title>
        {d.riskByGrade.length === 0 ? <Text c="dimmed" size="sm">Нет данных.</Text> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.riskByGrade.map((g) => ({ name: `${g.grade}-е`, Кейсы: g.count }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><RTooltip />
              <Bar dataKey="Кейсы" fill="#e8590c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="xs">По уровням риска</Title>
        <Group>
          {Object.entries(RISK).map(([k, v]) => (
            <Badge key={k} size="lg" color={v.color} variant="light">{v.label}: {d.byRisk[k] ?? 0}</Badge>
          ))}
        </Group>
      </Paper>

      {level === 'coordinator' && (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Paper withBorder p="md" radius="md">
            <Title order={5} mb="xs">Средняя оценка ИИ</Title>
            <Text size="xl" fw={700}>{d.ai?.avg != null ? d.ai.avg.toFixed(1) : '—'} <Text span size="sm" c="dimmed">({d.ai?.count ?? 0})</Text></Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Title order={5} mb="xs">По психологам</Title>
            {d.byPsychologist && d.byPsychologist.length > 0 ? (
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Логин</Table.Th>
                    <Table.Th ta="right">Кейсов</Table.Th>
                    <Table.Th ta="right">В зоне риска</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {d.byPsychologist.map((row) => (
                    <Table.Tr key={row.userId}>
                      <Table.Td>{row.login}</Table.Td>
                      <Table.Td ta="right">{row.cases}</Table.Td>
                      <Table.Td ta="right">{row.atRisk}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : <Text c="dimmed" size="sm">Нет данных.</Text>}
          </Paper>
        </SimpleGrid>
      )}
    </Stack>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <Card withBorder radius="md" padding="md">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="xl" fw={700} c={color}>{value}</Text>
    </Card>
  );
}

export default function PsyOverviewPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'senior_psychologist', 'safeguarding_lead', 'psychologist', 'specialist', 'psy_coordinator']}>
      <Overview />
    </RoleGate>
  );
}
