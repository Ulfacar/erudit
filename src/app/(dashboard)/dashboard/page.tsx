'use client';

import {
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconAward,
  IconBriefcase,
  IconChevronRight,
  IconCircleCheck,
  IconDownload,
  IconPlus,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useMe } from '@/shared/hooks/useMe';

/* ── Types ── */
interface DashboardStats {
  totalStudents: number;
  todayStudents: number;
  studentsDiff: number;
  totalTeachers: number;
  teachersDiff: number;
  totalClasses: number;
  classesDiff: number;
  totalParallels: number;
  parallelsDiff: number;
}

interface LowPerformanceItem {
  studentName: string;
  className: string;
  subjectName: string;
  average: number;
}

interface ClassAvgItem {
  className: string;
  average: number;
}

interface UrgentIssue {
  id: string;
  title: string;
  description: string;
  priority: string;
  createdAt: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: string;
  createdAt: string;
}

/* «Ваш экран»: домены экосистемы одной выдачей (/api/v1/dashboard/domains) */
interface DomainsData {
  finance: { invoiced: number; paid: number; debt: number; debtStudents: number } | null;
  psych: { sessions30: number; studentsInWork: number; recommendations30: number };
  hr: { teachers: number; weeklyHours: number; staff: number };
  admission: { total: number; inPipeline: number; enrolled: number; conversion: number };
  retention: { rejectedTotal: number; reasons: Array<{ name: string; reason: string }> };
  quality: { avgGrade: number | null; attendanceRate: number | null };
  ai: { active: number; latest: Array<{ title: string; severity: string }> };
}

/* ── Helpers ── */
function KpiCard({ icon: Icon, label, value, delta, deltaDir, sub }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  delta?: string;
  deltaDir?: 'up' | 'down';
  sub?: string;
}) {
  return (
    <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
      <Group gap={8} mb={6}>
        <Icon size={14} />
        <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      </Group>
      <Group gap={14} align="baseline">
        <Text fw={700} style={{ fontSize: 28, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
          {value}
        </Text>
        {delta && (
          <Badge
            size="sm"
            variant="light"
            color={deltaDir === 'up' ? 'green' : 'red'}
            leftSection={deltaDir === 'up' ? <IconArrowUpRight size={12} /> : <IconArrowDownRight size={12} />}
          >
            {delta}
          </Badge>
        )}
      </Group>
      {sub && <Text size="xs" c="dimmed" mt={4}>{sub}</Text>}
    </Paper>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

const SEVERITY_COLOR: Record<string, string> = { high: 'red', medium: 'yellow', low: 'green' };
const PRIORITY_COLOR: Record<string, string> = { high: 'red', medium: 'yellow', low: 'blue' };

/* Карточка домена экосистемы («Ваш экран», слайд презентации) */
function DomainCard({ title, color, href, lines }: {
  title: string;
  color: string;
  href: string;
  lines: Array<{ label: string; value: string }>;
}) {
  return (
    <Paper
      component="a"
      href={href}
      p="md"
      radius="lg"
      withBorder
      style={{
        border: '1px solid #e6e9ee',
        borderTop: `3px solid var(--mantine-color-${color}-5)`,
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 18px rgba(15,23,42,0.08)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      <Group justify="space-between" mb={8}>
        <Text fw={700} size="sm" c={`${color}.7`}>{title}</Text>
        <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />
      </Group>
      <Stack gap={3}>
        {lines.map((l) => (
          <Group key={l.label} justify="space-between" gap={8} wrap="nowrap">
            <Text size="xs" c="dimmed" lineClamp={1}>{l.label}</Text>
            <Text size="xs" fw={600} style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{l.value}</Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}

const som = (n: number) => `${n.toLocaleString('ru-RU')} сом`;

function DashboardContent() {
  const { me } = useMe();

  const { data, isLoading } = useQuery<{ success: boolean; data: { stats: DashboardStats; lowPerformance: LowPerformanceItem[]; medicalIssues: unknown[] } }>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/v1/dashboard');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: analyticsData } = useQuery<{ success: boolean; data: { classByAverage: ClassAvgItem[]; weeklyAttendance: number } }>({
    queryKey: ['dashboard-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/v1/dashboard/analytics');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: domainsData } = useQuery<{ success: boolean; data: DomainsData }>({
    queryKey: ['dashboard-domains'],
    queryFn: async () => {
      const res = await fetch('/api/v1/dashboard/domains');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: insightsData } = useQuery<{ success: boolean; data: Array<{ severity: string; title: string; detail: string; href: string }> }>({
    queryKey: ['dashboard-insights'],
    queryFn: async () => {
      const res = await fetch('/api/v1/dashboard/insights');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: urgentData } = useQuery<{ success: boolean; data: UrgentIssue[] }>({
    queryKey: ['urgent-issues-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/v1/urgent-issues?status=open');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: incidentsData } = useQuery<{ success: boolean; data: Incident[] }>({
    queryKey: ['incidents-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/v1/incidents?status=open');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const stats = data?.data?.stats;
  const lowPerformance = data?.data?.lowPerformance ?? [];
  const classByAverage = analyticsData?.data?.classByAverage ?? [];
  const weeklyAttendance = analyticsData?.data?.weeklyAttendance ?? 0;
  const urgentIssues = urgentData?.data ?? [];
  const incidentsList = incidentsData?.data ?? [];

  if (isLoading) {
    return <Group justify="center" py={80}><Loader size="lg" /></Group>;
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  })();

  const userName = me?.teacher
    ? `${me.teacher.lastName} ${me.teacher.firstName}`
    : me?.login ?? '';

  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Stack gap="lg">
      {/* ── Header ── */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Text fw={700} style={{ fontSize: 24, letterSpacing: '-0.02em' }}>
            {greeting}, {userName}
          </Text>
          <Text size="sm" c="dimmed" mt={4} style={{ textTransform: 'capitalize' }}>{today}</Text>
        </div>
        <Group gap={8} visibleFrom="sm">
          <Box component="button" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 8, fontWeight: 600, fontSize: 13.5, border: '1px solid #dde1e8', background: 'white', cursor: 'pointer' }}>
            <IconDownload size={16} /> Экспорт отчёта
          </Box>
          <Box component="button" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 8, fontWeight: 600, fontSize: 13.5, border: 'none', background: '#228be6', color: 'white', cursor: 'pointer', boxShadow: '0 1px 2px rgba(28,126,214,0.18)' }}>
            <IconPlus size={16} /> Создать объявление
          </Box>
        </Group>
      </Group>

      {/* ── KPI Cards ── */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <KpiCard
          icon={IconUsers}
          label="Всего учеников"
          value={stats?.totalStudents?.toLocaleString('ru') ?? '0'}
          delta={`${stats?.studentsDiff ?? 0} за месяц`}
          deltaDir="up"
          sub={`${stats?.totalClasses ?? 0} классов`}
        />
        <KpiCard
          icon={IconCircleCheck}
          label="Посещаемость сегодня"
          value={`${weeklyAttendance}%`}
          delta="за неделю"
          deltaDir={weeklyAttendance >= 90 ? 'up' : 'down'}
        />
        <KpiCard
          icon={IconAward}
          label="Средний балл по школе"
          value={classByAverage.length > 0 ? (classByAverage.reduce((s, c) => s + c.average, 0) / classByAverage.length).toFixed(2) : '—'}
          deltaDir="up"
        />
        <KpiCard
          icon={IconBriefcase}
          label="Учителей в системе"
          value={String(stats?.totalTeachers ?? 0)}
        />
      </SimpleGrid>

      {/* ── Экосистема школы: домены из единого ядра («Ваш экран») ── */}
      {domainsData?.data && (() => {
        const d = domainsData.data;
        return (
          <div>
            <Group justify="space-between" mb={8}>
              <div>
                <Text fw={600} size="md">Экосистема школы</Text>
                <Text size="xs" c="dimmed">Все домены из одного ядра · обновляется в реальном времени</Text>
              </div>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              {d.finance && (
                <DomainCard
                  title="Финансы"
                  color="orange"
                  href="/workspace/accounting"
                  lines={[
                    { label: 'Начислено', value: som(d.finance.invoiced) },
                    { label: 'Оплачено', value: som(d.finance.paid) },
                    { label: 'Задолженность', value: `${som(d.finance.debt)} · ${d.finance.debtStudents} уч.` },
                  ]}
                />
              )}
              <DomainCard
                title="Психологи"
                color="violet"
                href="/workspace/psychologist"
                lines={[
                  { label: 'Сессий за 30 дней', value: String(d.psych.sessions30) },
                  { label: 'Учеников в работе', value: String(d.psych.studentsInWork) },
                  { label: 'Рекомендаций', value: String(d.psych.recommendations30) },
                ]}
              />
              <DomainCard
                title="Приёмная"
                color="teal"
                href="/admission"
                lines={[
                  { label: 'Заявок всего', value: String(d.admission.total) },
                  { label: 'В воронке', value: String(d.admission.inPipeline) },
                  { label: 'Конверсия', value: `${d.admission.conversion}%` },
                ]}
              />
              <DomainCard
                title="HR"
                color="green"
                href="/staff"
                lines={[
                  { label: 'Педагогов', value: String(d.hr.teachers) },
                  { label: 'Нагрузка, ч/нед', value: String(d.hr.weeklyHours) },
                  { label: 'Прочий персонал', value: String(d.hr.staff) },
                ]}
              />
              <DomainCard
                title="Retention"
                color="red"
                href="/admission"
                lines={[
                  { label: 'Отказов', value: String(d.retention.rejectedTotal) },
                  ...(d.retention.reasons.slice(0, 2).map((r) => ({ label: r.name, value: r.reason.slice(0, 28) }))),
                ]}
              />
              <DomainCard
                title="Качество"
                color="blue"
                href="/analytics"
                lines={[
                  { label: 'Средний балл', value: d.quality.avgGrade != null ? String(d.quality.avgGrade) : '—' },
                  { label: 'Посещаемость 30 дн', value: d.quality.attendanceRate != null ? `${d.quality.attendanceRate}%` : '—' },
                ]}
              />
              <DomainCard
                title="AI-инсайты"
                color="grape"
                href="/agent"
                lines={[
                  { label: 'Активных сигналов', value: String(d.ai.active) },
                  ...(d.ai.latest.slice(0, 2).map((i) => ({ label: i.severity === 'warn' || i.severity === 'urgent' ? '⚠️ сигнал' : 'сигнал', value: i.title.slice(0, 28) }))),
                ]}
              />
              <DomainCard
                title="Граф ядра"
                color="indigo"
                href="/core"
                lines={[
                  { label: 'Визуализация', value: 'нейросвязи' },
                  { label: 'Все модули', value: 'одно ядро' },
                ]}
              />
            </SimpleGrid>
          </div>
        );
      })()}

      {/* ── AI-инсайты: аномалии, найденные ядром по реальным данным ── */}
      {insightsData?.data && (
        <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Group justify="space-between" mb="sm">
            <div>
              <Text fw={600} size="md">🧠 AI-инсайты ядра</Text>
              <Text size="xs" c="dimmed">Аномалии и сигналы, которые система нашла сама</Text>
            </div>
            <Badge size="sm" variant="light" color={insightsData.data.length ? 'grape' : 'teal'}>
              {insightsData.data.length || '✓'}
            </Badge>
          </Group>
          {insightsData.data.length === 0 ? (
            <Text c="dimmed" size="sm">Аномалий не обнаружено — школа в норме ✅</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm">
              {insightsData.data.map((ins, i) => (
                <Paper
                  key={i}
                  component="a"
                  href={ins.href}
                  p="sm"
                  radius="md"
                  withBorder
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor: `var(--mantine-color-${ins.severity === 'urgent' ? 'red' : ins.severity === 'warn' ? 'orange' : 'blue'}-5)`,
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <Text size="sm" fw={600}>{ins.title}</Text>
                  <Text size="xs" c="dimmed" mt={2}>{ins.detail}</Text>
                </Paper>
              ))}
            </SimpleGrid>
          )}
        </Paper>
      )}

      {/* ── Main grid ── */}
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        {/* Urgent issues */}
        <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Group justify="space-between" mb="md">
            <div>
              <Text fw={600} size="md">Срочные вопросы</Text>
              <Text size="xs" c="dimmed">Открытые обращения</Text>
            </div>
            <Badge size="sm" color="red" variant="light">{urgentIssues.length}</Badge>
          </Group>
          {urgentIssues.length === 0 ? (
            <Text ta="center" c="dimmed" py="md">Нет открытых вопросов</Text>
          ) : (
            <Stack gap={0}>
              {urgentIssues.slice(0, 5).map((issue, i) => (
                <Group key={issue.id} gap={12} py={10} style={{ borderBottom: i < Math.min(urgentIssues.length, 5) - 1 ? '1px solid #eef0f4' : 'none' }}>
                  <Box style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: `var(--mantine-color-${PRIORITY_COLOR[issue.priority] ?? 'gray'}-5)` }} />
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>{issue.title}</Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>{issue.description}</Text>
                  </div>
                  <Text size="xs" c="dimmed">{timeAgo(issue.createdAt)}</Text>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>

        {/* Incidents */}
        <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Group justify="space-between" mb="md">
            <div>
              <Text fw={600} size="md">Происшествия</Text>
              <Text size="xs" c="dimmed">Открытые инциденты</Text>
            </div>
            <Badge size="sm" color="orange" variant="light">{incidentsList.length}</Badge>
          </Group>
          {incidentsList.length === 0 ? (
            <Text ta="center" c="dimmed" py="md">Нет открытых происшествий</Text>
          ) : (
            <Stack gap={10}>
              {incidentsList.slice(0, 3).map((item) => (
                <Paper
                  key={item.id}
                  p="sm"
                  radius="md"
                  withBorder
                  style={{ borderLeftWidth: 4, borderLeftColor: `var(--mantine-color-${SEVERITY_COLOR[item.severity] ?? 'gray'}-5)` }}
                >
                  <Text size="sm" fw={600} mb={4}>{item.title}</Text>
                  <Text size="xs" c="dimmed" lineClamp={2}>{item.description}</Text>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </SimpleGrid>

      {/* ── Class averages table ── */}
      {classByAverage.length > 0 && (
        <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Group justify="space-between" mb="md">
            <div>
              <Text fw={600} size="md">Средний балл по классам</Text>
              <Text size="xs" c="dimmed">Текущий период</Text>
            </div>
          </Group>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Класс</Table.Th>
                <Table.Th ta="center">Средний балл</Table.Th>
                <Table.Th style={{ width: '35%' }}>Прогресс</Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {classByAverage.map((c) => {
                const pct = Math.max(0, Math.min(100, ((c.average - 2) / 3) * 100));
                const color = c.average >= 4.3 ? '#40c057' : c.average >= 3.5 ? '#228be6' : '#fab005';
                return (
                  <Table.Tr key={c.className}>
                    <Table.Td>
                      <Group gap={10}>
                        <Box style={{ width: 32, height: 32, borderRadius: 8, background: '#f8f9fb', border: '1px solid #e6e9ee', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, color: '#374151' }}>
                          {c.className}
                        </Box>
                      </Group>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Text fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>{c.average.toFixed(2)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Box style={{ height: 6, background: '#eef0f4', borderRadius: 3, overflow: 'hidden' }}>
                        <Box style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                      </Box>
                    </Table.Td>
                    <Table.Td>
                      <IconChevronRight size={14} color="#9ba2ad" />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* ── Low performance ── */}
      {lowPerformance.length > 0 && (
        <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Group justify="space-between" mb="md">
            <div>
              <Text fw={600} size="md">Группа риска</Text>
              <Text size="xs" c="dimmed">Низкая успеваемость</Text>
            </div>
            <Badge size="sm" color="yellow" variant="light">{lowPerformance.length}</Badge>
          </Group>
          <Stack gap={0}>
            {lowPerformance.slice(0, 5).map((s, i) => (
              <Group key={i} gap={12} py={10} style={{ borderBottom: i < Math.min(lowPerformance.length, 5) - 1 ? '1px solid #eef0f4' : 'none' }}>
                <Box style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #ffd43b, #f08c00)', display: 'grid', placeItems: 'center', color: 'white', fontSize: 11, fontWeight: 600 }}>
                  {s.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </Box>
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={600}>{s.studentName}</Text>
                  <Text size="xs" c="dimmed">{s.className} · {s.subjectName} · {s.average.toFixed(2)}</Text>
                </div>
                <IconChevronRight size={14} color="#9ba2ad" />
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

export default function DashboardPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'specialist']}>
      <DashboardContent />
    </RoleGate>
  );
}
