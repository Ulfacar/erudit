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
  IconBuildingBank,
  IconCash,
  IconChartPie,
  IconChecklist,
  IconSchool,
  IconTools,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface FounderInsight {
  severity: 'info' | 'warn' | 'urgent';
  title: string;
  detail: string;
  href: string;
}

interface FounderOverview {
  finance: {
    totalAmount: number;
    totalPaid: number;
    totalRemaining: number;
    totalPenalty: number;
    collectRate: number;
    debtByClass: Array<{ classLabel: string; remaining: number; penalty: number; students: number }>;
  };
  inventory: Array<{ category: string; count: number; quantity: number }>;
  school: {
    students: number;
    teachers: number;
    classes: number;
    occupancyRate: number | null;
    attendanceTodayRate: number | null;
    events: number;
    purchaseRequests: number;
    timeOffRequests: number;
  };
  psych: {
    sessions: number;
    cases: number;
    topClasses: Array<{ classLabel: string; cases: number }>;
  };
  insights: FounderInsight[];
}

const som = (value: number) => `${value.toLocaleString('ru-RU')} сом`;

function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Paper p="lg" radius="md" withBorder style={{ border: '1px solid #e6e9ee' }}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size={42} radius="md" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            {label}
          </Text>
          <Text fw={700} style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }} truncate>
            {value}
          </Text>
          {sub && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {sub}
            </Text>
          )}
        </div>
      </Group>
    </Paper>
  );
}

function FounderContent() {
  const { data, isLoading } = useQuery<FounderOverview>({
    queryKey: ['founder-overview'],
    queryFn: async () => {
      const res = await fetch('/api/v1/founder/overview');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка загрузки');
      return json.data;
    },
  });

  if (isLoading || !data) {
    return (
      <Center h={320}>
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2} style={{ letterSpacing: '-0.02em' }}>
            Учредитель
          </Title>
          <Text c="dimmed" size="sm">
            Финансы, школа, имущество и обезличенная психостатистика
          </Text>
        </div>
        <Badge size="lg" variant="light" color={data.finance.collectRate >= 85 ? 'green' : 'orange'}>
          Сбор {data.finance.collectRate}%
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <KpiCard label="Начислено" value={som(data.finance.totalAmount)} color="blue" icon={<IconBuildingBank size={22} />} />
        <KpiCard label="Оплачено" value={som(data.finance.totalPaid)} color="green" icon={<IconCash size={22} />} />
        <KpiCard label="Остаток" value={som(data.finance.totalRemaining)} color="orange" icon={<IconAlertTriangle size={22} />} />
        <KpiCard label="Ученики" value={String(data.school.students)} sub={`${data.school.classes} классов · ${data.school.teachers} педагогов`} color="teal" icon={<IconUsers size={22} />} />
      </SimpleGrid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="lg" radius="md" withBorder style={{ border: '1px solid #e6e9ee', height: '100%' }}>
            <Text fw={600} mb="sm">Собираемость</Text>
            <Center>
              <RingProgress
                size={160}
                thickness={14}
                roundCaps
                sections={[{ value: Math.min(data.finance.collectRate, 100), color: data.finance.collectRate >= 85 ? 'green' : data.finance.collectRate >= 70 ? 'yellow' : 'red' }]}
                label={<Text ta="center" fw={700} style={{ fontSize: 24 }}>{data.finance.collectRate}%</Text>}
              />
            </Center>
            <Stack gap={6} mt="sm">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Пени</Text>
                <Text size="sm" fw={600}>{som(data.finance.totalPenalty)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Наполняемость</Text>
                <Text size="sm" fw={600}>{data.school.occupancyRate === null ? '—' : `${data.school.occupancyRate}%`}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Сегодня посещаемость</Text>
                <Text size="sm" fw={600}>{data.school.attendanceTodayRate === null ? '—' : `${data.school.attendanceTodayRate}%`}</Text>
              </Group>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper p="lg" radius="md" withBorder style={{ border: '1px solid #e6e9ee', height: '100%' }}>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Долги по классам</Text>
              <Badge variant="light" color="gray">{data.finance.debtByClass.length}</Badge>
            </Group>
            {data.finance.debtByClass.length === 0 ? (
              <Text c="dimmed" size="sm">Нет классов с задолженностью.</Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Класс</Table.Th>
                    <Table.Th ta="right">Ученики</Table.Th>
                    <Table.Th ta="right">Остаток</Table.Th>
                    <Table.Th ta="right">Пени</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.finance.debtByClass.slice(0, 6).map((row) => (
                    <Table.Tr key={row.classLabel}>
                      <Table.Td><Badge variant="light" color="blue">{row.classLabel}</Badge></Table.Td>
                      <Table.Td ta="right">{row.students}</Table.Td>
                      <Table.Td ta="right"><Text fw={600} c="orange">{som(row.remaining)}</Text></Table.Td>
                      <Table.Td ta="right">{row.penalty > 0 ? som(row.penalty) : '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <Paper p="lg" radius="md" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Group gap="xs" mb="sm">
            <IconSchool size={18} />
            <Text fw={600}>Школа</Text>
          </Group>
          <Stack gap={8}>
            <Group justify="space-between"><Text size="sm" c="dimmed">Мероприятия впереди</Text><Badge variant="light">{data.school.events}</Badge></Group>
            <Group justify="space-between"><Text size="sm" c="dimmed">Заявки на закупку</Text><Badge color={data.school.purchaseRequests ? 'orange' : 'green'} variant="light">{data.school.purchaseRequests}</Badge></Group>
            <Group justify="space-between"><Text size="sm" c="dimmed">Отгулы на согласовании</Text><Badge color={data.school.timeOffRequests ? 'orange' : 'green'} variant="light">{data.school.timeOffRequests}</Badge></Group>
          </Stack>
        </Paper>

        <Paper p="lg" radius="md" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Group gap="xs" mb="sm">
            <IconTools size={18} />
            <Text fw={600}>Имущество</Text>
          </Group>
          <Stack gap={8}>
            {data.inventory.slice(0, 5).map((item) => (
              <Group key={item.category} justify="space-between" gap="sm" wrap="nowrap">
                <Text size="sm" lineClamp={1}>{item.category}</Text>
                <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>{item.quantity} ед.</Text>
              </Group>
            ))}
            {data.inventory.length === 0 && <Text size="sm" c="dimmed">Имущество не заведено.</Text>}
          </Stack>
        </Paper>

        <Paper p="lg" radius="md" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Group gap="xs" mb="sm">
            <IconChartPie size={18} />
            <Text fw={600}>Психология, агрегат</Text>
          </Group>
          <Stack gap={8}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Сессии</Text>
              <Group gap={6}>
                <IconChecklist size={16} />
                <Text size="sm" fw={700}>{data.psych.sessions}</Text>
              </Group>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Кейсы</Text>
              <Group gap={6}>
                <IconChartPie size={16} />
                <Text size="sm" fw={700}>{data.psych.cases}</Text>
              </Group>
            </Group>
            {data.psych.topClasses.slice(0, 3).map((item) => (
              <Group key={item.classLabel} justify="space-between">
                <Text size="sm" c="dimmed">{item.classLabel}</Text>
                <Badge variant="light" color="violet">{item.cases}</Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper p="lg" radius="md" withBorder style={{ border: '1px solid #e6e9ee' }}>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>AI-инсайты учредителя</Text>
          <Badge variant="light" color={data.insights.some((i) => i.severity === 'urgent') ? 'red' : 'grape'}>
            {data.insights.length}
          </Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {data.insights.map((insight) => (
            <Paper
              key={`${insight.title}-${insight.href}`}
              component="a"
              href={insight.href}
              p="sm"
              radius="md"
              withBorder
              style={{
                borderLeftWidth: 4,
                borderLeftColor: `var(--mantine-color-${insight.severity === 'urgent' ? 'red' : insight.severity === 'warn' ? 'orange' : 'blue'}-5)`,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <Text size="sm" fw={600}>{insight.title}</Text>
              <Text size="xs" c="dimmed" mt={3}>{insight.detail}</Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Paper>
    </Stack>
  );
}

export default function FounderPage() {
  return (
    <RoleGate roles={['super_admin', 'founder']}>
      <FounderContent />
    </RoleGate>
  );
}
