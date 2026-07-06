'use client';

import { Badge, Group, Loader, Paper, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconChartBar, IconSchool, IconTimelineEvent } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { CcAdmissionStatus } from '@prisma/client';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { CC_ADMISSION_STATUS_LABELS } from '@/modules/cc/labels';

const REPORT_ROLES = ['founder', 'super_admin', 'college_counselor'] as const;

type Report = {
  totals: { profiles: number; acceptedPercent: number; scholarshipTotal: number };
  stageCounts: Record<string, number>;
  upcomingDeadlines: Array<{ applicationId: string; student: string; className: string; universityName: string; deadlineDate: string; daysLeft: number }>;
  riskStudents: Array<{ profileId: string; student: string; className: string; gpa: number | null; risks: string[] }>;
  classReport: Array<{ className: string; total: number; withCountry: number; withMajor: number; withExams: number; withApplications: number }>;
};

function dateText(value: string) {
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function StatCard({ icon: Icon, label, value }: { icon: typeof IconChartBar; label: string; value: string | number }) {
  return (
    <Paper withBorder radius="sm" p="md">
      <Group gap="sm">
        <ThemeIcon variant="light" color="green" radius="sm" size={38}>
          <Icon size={20} />
        </ThemeIcon>
        <div>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text fw={700} size="xl">{value}</Text>
        </div>
      </Group>
    </Paper>
  );
}

function CcReports() {
  const { data, isLoading } = useQuery<Report>({
    queryKey: ['cc-reports'],
    queryFn: async () => {
      const res = await fetch('/api/v1/cc/reports');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить отчёт');
      return json.data;
    },
  });

  if (isLoading || !data) return <Group justify="center" py="xl"><Loader /></Group>;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>CC: отчёт</Title>
        <Text size="sm" c="dimmed">Read-only сводка по колледж-консалтингу</Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <StatCard icon={IconSchool} label="Профилей" value={data.totals.profiles} />
        <StatCard icon={IconChartBar} label="Поступили" value={`${data.totals.acceptedPercent}%`} />
        <StatCard icon={IconTimelineEvent} label="Стипендии" value={`$${data.totals.scholarshipTotal.toLocaleString('ru-RU')}`} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Paper withBorder radius="sm" p="md">
          <Title order={4} mb="sm">Воронка</Title>
          <Stack gap="xs">
            {Object.entries(data.stageCounts).map(([stage, count]) => (
              <Group key={stage} justify="space-between">
                <Text size="sm">{CC_ADMISSION_STATUS_LABELS[stage as CcAdmissionStatus] ?? stage}</Text>
                <Badge variant="light" radius="sm">{count}</Badge>
              </Group>
            ))}
            {Object.keys(data.stageCounts).length === 0 && <Text c="dimmed" size="sm">Нет заявок</Text>}
          </Stack>
        </Paper>

        <Paper withBorder radius="sm" p="md">
          <Group gap="xs" mb="sm">
            <IconAlertTriangle size={18} color="var(--mantine-color-red-6)" />
            <Title order={4}>Риски</Title>
          </Group>
          <Stack gap="xs">
            {data.riskStudents.map((row) => (
              <Group key={row.profileId} justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" fw={600}>{row.student}</Text>
                  <Text size="xs" c="dimmed">{row.className} · GPA {row.gpa ?? '—'}</Text>
                </div>
                <Group gap={4} justify="flex-end">
                  {row.risks.map((risk) => <Badge key={risk} color="red" variant="light" radius="sm">{risk}</Badge>)}
                </Group>
              </Group>
            ))}
            {data.riskStudents.length === 0 && <Text c="dimmed" size="sm">Рисков не найдено</Text>}
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
        <Table striped verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Дедлайн</Table.Th>
              <Table.Th>Ученик</Table.Th>
              <Table.Th>Класс</Table.Th>
              <Table.Th>Вуз</Table.Th>
              <Table.Th>Дней</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.upcomingDeadlines.map((row) => (
              <Table.Tr key={row.applicationId}>
                <Table.Td>{dateText(row.deadlineDate)}</Table.Td>
                <Table.Td>{row.student}</Table.Td>
                <Table.Td>{row.className}</Table.Td>
                <Table.Td>{row.universityName}</Table.Td>
                <Table.Td><Badge color={row.daysLeft <= 7 ? 'red' : 'blue'} variant="light" radius="sm">{row.daysLeft}</Badge></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Класс</Table.Th>
              <Table.Th>Всего</Table.Th>
              <Table.Th>Страна</Table.Th>
              <Table.Th>Направление</Table.Th>
              <Table.Th>Экзамены</Table.Th>
              <Table.Th>Вузы</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.classReport.map((row) => (
              <Table.Tr key={row.className}>
                <Table.Td>{row.className}</Table.Td>
                <Table.Td>{row.total}</Table.Td>
                <Table.Td>{row.withCountry}</Table.Td>
                <Table.Td>{row.withMajor}</Table.Td>
                <Table.Td>{row.withExams}</Table.Td>
                <Table.Td>{row.withApplications}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}

export default function CcReportsPage() {
  return (
    <RoleGate roles={[...REPORT_ROLES]}>
      <CcReports />
    </RoleGate>
  );
}
