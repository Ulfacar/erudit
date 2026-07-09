'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Button, Group, Loader, NumberInput, Paper, ScrollArea, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconChartBar } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { kpiColor } from '@/modules/olympiad/kpi';

const ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;

type Participant = { studentId: string; fio: string; className: string };
type StudentMetric = { studentId: string; tasksTotal: number | null; tasksSolved: number | null; kpi: number | null };
type MetricsPayload = {
  participants: Participant[];
  metrics: StudentMetric[];
  config: { w1: number; w2: number; w3: number; version: number };
  totalDays: number;
  attendanceByStudent: Record<string, number>;
};
type RowState = Record<string, { tasksTotal: number; tasksSolved: number }>;

function numericValue(value: string | number) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Math.trunc(next)) : 0;
}

function MetricsContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<RowState>({});

  const metricsQuery = useQuery<MetricsPayload>({
    queryKey: ['olympiad-intensive-metrics', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/olympiad-center/intensives/${id}/metrics`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить метрики');
      return json.data;
    },
  });

  useEffect(() => {
    if (!metricsQuery.data) return;
    const byStudent = new Map(metricsQuery.data.metrics.map((metric) => [metric.studentId, metric]));
    setRows(Object.fromEntries(metricsQuery.data.participants.map((participant) => {
      const metric = byStudent.get(participant.studentId);
      return [participant.studentId, { tasksTotal: metric?.tasksTotal ?? 0, tasksSolved: metric?.tasksSolved ?? 0 }];
    })));
  }, [metricsQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payloadRows = Object.entries(rows).map(([studentId, row]) => ({ studentId, tasksTotal: row.tasksTotal, tasksSolved: row.tasksSolved }));
      const invalid = payloadRows.some((row) => row.tasksSolved > row.tasksTotal || row.tasksSolved < 0 || row.tasksTotal < 0);
      if (invalid) throw new Error('Решено не может быть больше общего числа задач');
      const res = await fetch(`/api/v1/olympiad-center/intensives/${id}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payloadRows }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось сохранить метрики');
      return json.data as MetricsPayload;
    },
    onSuccess: (data) => {
      notifications.show({ color: 'green', title: 'Готово', message: 'Метрики сохранены' });
      queryClient.setQueryData(['olympiad-intensive-metrics', id], data);
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось сохранить метрики' }),
  });

  if (metricsQuery.isLoading) return <Group justify="center" py="xl"><Loader /></Group>;
  if (metricsQuery.isError || !metricsQuery.data) return <Text c="red">Не удалось загрузить метрики</Text>;

  const data = metricsQuery.data;
  const metricByStudent = new Map(data.metrics.map((metric) => [metric.studentId, metric]));

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <ThemeIcon size={40} radius="sm" color="blue" variant="light"><IconChartBar size={22} /></ThemeIcon>
          <div>
            <Title order={2}>Метрики и KPI</Title>
            <Text size="sm" c="dimmed">Версия KPI: {data.config.version}</Text>
          </div>
        </Group>
        <Button component={Link} href={`/olympiad-center/intensives/${id}`} variant="subtle" leftSection={<IconArrowLeft size={16} />}>Назад к интенсиву</Button>
      </Group>

      <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={860}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th miw={260}>Ученик</Table.Th>
                <Table.Th w={150}>Всего задач</Table.Th>
                <Table.Th w={150}>Решено</Table.Th>
                <Table.Th ta="center" w={140}>Посещений</Table.Th>
                <Table.Th ta="center" w={120}>KPI</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.participants.map((participant) => {
                const metric = metricByStudent.get(participant.studentId);
                const row = rows[participant.studentId] ?? { tasksTotal: 0, tasksSolved: 0 };
                const invalid = row.tasksSolved > row.tasksTotal;
                return (
                  <Table.Tr key={participant.studentId}>
                    <Table.Td>
                      <Text fw={600}>{participant.fio}</Text>
                      <Text size="xs" c="dimmed">{participant.className || 'Без класса'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <NumberInput min={0} step={1} value={row.tasksTotal} onChange={(value) => setRows((current) => ({ ...current, [participant.studentId]: { ...row, tasksTotal: numericValue(value) } }))} />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput min={0} max={row.tasksTotal} step={1} error={invalid} value={row.tasksSolved} onChange={(value) => setRows((current) => ({ ...current, [participant.studentId]: { ...row, tasksSolved: numericValue(value) } }))} />
                    </Table.Td>
                    <Table.Td ta="center"><Badge variant="light" color="teal" radius="sm">{data.attendanceByStudent[participant.studentId] ?? 0} / {data.totalDays}</Badge></Table.Td>
                    <Table.Td ta="center"><Badge variant="light" color={kpiColor(metric?.kpi ?? 0)} radius="sm">{metric?.kpi ?? 0}</Badge></Table.Td>
                  </Table.Tr>
                );
              })}
              {data.participants.length === 0 && (
                <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="lg">Участники еще не добавлены</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Group justify="flex-end">
        <Button loading={save.isPending} disabled={Object.values(rows).some((row) => row.tasksSolved > row.tasksTotal)} onClick={() => save.mutate()}>Сохранить</Button>
      </Group>
    </Stack>
  );
}

export default function OlympiadCenterIntensiveMetricsPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <MetricsContent />
    </RoleGate>
  );
}
