'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconAward, IconChartLine, IconFileSpreadsheet, IconListDetails, IconUser } from '@tabler/icons-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { kpiColor } from '@/modules/olympiad/kpi';
import { exportOlympiadStudentSummaryExcel } from '@/modules/olympiad/excel';

const ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;
const EMPTY = '—';
const STATUS_LABELS: Record<string, string> = {
  enrolled: 'Записан',
  participated: 'Участвовал',
  no_show: 'Не явился',
};

type Summary = {
  student: { id: string; fio: string; className: string };
  currentKpi: number | null;
  kpiSeries: { label: string; date: string | null; kpi: number | null }[];
  intensives: {
    intensiveId: string;
    olympiadId?: string | null;
    name: string;
    kpi: number | null;
    attendedDays: number;
    totalDays: number;
    tasksSolved: number;
    tasksTotal: number;
    date: string | null;
  }[];
  awards: { title: string; place: string | null; level: string; date: string | null; olympiadId?: string | null }[];
  enrollments: {
    olympiadId?: string | null;
    olympiadName: string;
    tour: string | null;
    status: string | null;
    awardValue: string | null;
    awardLabel: string | null;
    date: string | null;
  }[];
};

function fmtDate(value?: string | null) {
  if (!value) return EMPTY;
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function fmtKpi(value: number | null) {
  return value == null ? EMPTY : Math.round(value);
}

function KpiBadge({ value }: { value: number | null }) {
  return (
    <Badge variant="light" color={value == null ? 'gray' : kpiColor(value)} radius="sm">
      KPI {fmtKpi(value)}
    </Badge>
  );
}

function KpiChart({ series }: { series: Summary['kpiSeries'] }) {
  const data = series.map((point) => ({
    label: point.label,
    date: fmtDate(point.date),
    kpi: point.kpi,
  }));

  if (data.length === 0) {
    return <Text c="dimmed" size="sm">Пока нет точек KPI.</Text>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={11} />
        <YAxis fontSize={11} domain={[0, 100]} />
        <RTooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''} />
        <Line type="monotone" dataKey="kpi" stroke="#1971c2" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function StudentSummaryContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/olympiad-center/students/${id}/summary`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить профиль');
      setSummary(json.data);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const activeEnrollments = useMemo(
    () => summary?.enrollments.filter((row) => row.status === 'enrolled' || row.status === 'participated') ?? [],
    [summary],
  );
  const historyEnrollments = useMemo(
    () => summary?.enrollments.filter((row) => row.status !== 'enrolled' && row.status !== 'participated') ?? [],
    [summary],
  );

  if (loading) return <Group justify="center" py="xl"><Loader /></Group>;
  if (error || !summary) return <Text c="red">{error ?? 'Не удалось загрузить профиль'}</Text>;

  return (
    <Stack gap="md">
      <Paper withBorder radius="sm" p="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <ThemeIcon size={42} radius="sm" color="orange" variant="light"><IconUser size={24} /></ThemeIcon>
            <div>
              <Title order={2}>{summary.student.fio}</Title>
              <Text size="sm" c="dimmed">{summary.student.className || EMPTY}</Text>
            </div>
          </Group>
          <Group gap="xs">
            <KpiBadge value={summary.currentKpi} />
            <Button leftSection={<IconFileSpreadsheet size={16} />} variant="light" onClick={() => exportOlympiadStudentSummaryExcel(summary)}>
              Экспорт сводки в Excel
            </Button>
          </Group>
        </Group>
      </Paper>

      <Paper withBorder radius="sm" p="md">
        <Group gap="xs" mb="sm"><IconChartLine size={18} /><Text fw={700}>Динамика KPI</Text></Group>
        <KpiChart series={summary.kpiSeries} />
      </Paper>

      <Paper withBorder radius="sm" p="md">
        <Group gap="xs" mb="sm"><IconListDetails size={18} /><Text fw={700}>Интенсивы</Text></Group>
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={760}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Название</Table.Th>
                <Table.Th>KPI</Table.Th>
                <Table.Th>Посещаемость</Table.Th>
                <Table.Th>Задачи</Table.Th>
                <Table.Th>Дата</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.intensives.map((row) => (
                <Table.Tr key={row.intensiveId}>
                  <Table.Td>{row.name}</Table.Td>
                  <Table.Td><KpiBadge value={row.kpi} /></Table.Td>
                  <Table.Td>{row.attendedDays}/{row.totalDays}</Table.Td>
                  <Table.Td>{row.tasksSolved}/{row.tasksTotal}</Table.Td>
                  <Table.Td>{fmtDate(row.date)}</Table.Td>
                </Table.Tr>
              ))}
              {summary.intensives.length === 0 && (
                <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="lg">Интенсивов пока нет</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Paper withBorder radius="sm" p="md">
        <Group gap="xs" mb="sm"><IconAward size={18} /><Text fw={700}>Награды</Text></Group>
        <Stack gap="xs">
          {summary.awards.map((award, index) => (
            <Group key={`${award.title}-${award.date}-${index}`} justify="space-between">
              <div>
                <Text fw={600}>{award.title}</Text>
                <Text size="sm" c="dimmed">{[award.place, award.level].filter(Boolean).join(' · ') || EMPTY}</Text>
              </div>
              <Text size="sm" c="dimmed">{fmtDate(award.date)}</Text>
            </Group>
          ))}
          {summary.awards.length === 0 && <Text c="dimmed" size="sm">Наград пока нет.</Text>}
        </Stack>
      </Paper>

      <Paper withBorder radius="sm" p="md">
        <Group gap="xs" mb="sm"><IconAward size={18} /><Text fw={700}>Записи на олимпиады</Text></Group>
        <Text fw={600} size="sm" mb="xs">Активные</Text>
        <EnrollmentTable rows={activeEnrollments} />
        <Text fw={600} size="sm" mt="md" mb="xs">История</Text>
        <EnrollmentTable rows={historyEnrollments} />
      </Paper>
    </Stack>
  );
}

function EnrollmentTable({ rows }: { rows: Summary['enrollments'] }) {
  return (
    <ScrollArea>
      <Table striped highlightOnHover verticalSpacing="sm" miw={760}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Олимпиада</Table.Th>
            <Table.Th>Тур</Table.Th>
            <Table.Th>Статус</Table.Th>
            <Table.Th>Награда</Table.Th>
            <Table.Th>Дата</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, index) => (
            <Table.Tr key={`${row.olympiadName}-${row.date}-${index}`}>
              <Table.Td>
                {row.olympiadId ? <Anchor href={`/olympiad-center/olympiads/${row.olympiadId}`}>{row.olympiadName}</Anchor> : row.olympiadName}
              </Table.Td>
              <Table.Td>{row.tour || EMPTY}</Table.Td>
              <Table.Td><Badge variant="light" radius="sm">{row.status ? STATUS_LABELS[row.status] ?? row.status : EMPTY}</Badge></Table.Td>
              <Table.Td>{row.awardLabel || EMPTY}</Table.Td>
              <Table.Td>{fmtDate(row.date)}</Table.Td>
            </Table.Tr>
          ))}
          {rows.length === 0 && (
            <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="md">Записей нет</Text></Table.Td></Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

export default function OlympiadStudentSummaryPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <StudentSummaryContent />
    </RoleGate>
  );
}
