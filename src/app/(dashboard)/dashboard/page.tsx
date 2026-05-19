'use client';

import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconChartBar,
  IconFlame,
  IconGridDots,
  IconMedicalCross,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

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

interface LowPerformanceEntry {
  className: string;
  studentName: string;
  period: string;
  subject: string;
  average: number;
  level: string;
}

interface MedicalEntry {
  studentName: string;
  role: string;
  daysAbsent: number;
  reason: string;
}

interface DashboardData {
  stats: DashboardStats;
  lowPerformance: LowPerformanceEntry[];
  medicalIssues: MedicalEntry[];
  urgentIssues: unknown[];
  incidents: unknown[];
}

interface AnalyticsData {
  classByAverage: { className: string; average: number }[];
  weeklyAttendance: number;
  topLowStudents: { name: string; class: string; avg: number }[];
}

/* ── Default empty stats ── */
const EMPTY_STATS: DashboardStats = {
  totalStudents: 0,
  todayStudents: 0,
  studentsDiff: 0,
  totalTeachers: 0,
  teachersDiff: 0,
  totalClasses: 0,
  classesDiff: 0,
  totalParallels: 0,
  parallelsDiff: 0,
};

const URGENT_DATA = [
  { topic: 'Протечка в кабинете 305', from: 'Завхоз Иванов', time: 'ПОЗАВЧЕРА', urgent: true, role: 'Персонал' },
  { topic: 'Жалоба от родителей 7А', from: 'Кл. рук. Петрова', time: 'ВЧЕРА', urgent: true, role: 'Родитель' },
  { topic: 'Замена педагога на 15.04', from: 'Зам. директора', time: 'СЕГОДНЯ', urgent: false, role: 'Педагог' },
  { topic: 'Обновление учебных материалов', from: 'Методист Сидорова', time: '3 ДНЯ НАЗАД', urgent: false, role: 'Педагог' },
  { topic: 'Ремонт спортзала', from: 'Директор', time: 'ВЧЕРА', urgent: true, role: 'Персонал' },
];

const INCIDENTS_DATA = [
  {
    title: 'Конфликт между учениками',
    description: 'В 8С классе произошел конфликт между учениками на перемене. Требуется вмешательство психолога.',
    color: 'red',
  },
  {
    title: 'Неисправность оборудования',
    description: 'В компьютерном классе вышли из строя 3 компьютера. Необходим ремонт.',
    color: 'yellow',
  },
  {
    title: 'Плановая проверка',
    description: 'Успешно пройдена плановая проверка пожарной безопасности.',
    color: 'green',
  },
];

/* ── Animation variants ── */
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' as const },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const staggerRow = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

/* ── Count-up hook ── */
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

/* ── Section Header ── */
function SectionHeader({
  title,
  icon,
  href,
}: {
  title: string;
  icon?: React.ReactNode;
  href: string;
}) {
  return (
    <Group justify="space-between" mb="sm">
      <Group gap={8}>
        {icon}
        <Text fw={600} size="sm">
          {title}
        </Text>
      </Group>
      <Button variant="outline" color="pink" size="xs" component={Link} href={href}>
        Посмотреть все
      </Button>
    </Group>
  );
}

/* ── Stat Card Icon mapping ── */
const CARD_ICONS: Record<string, React.ReactNode> = {
  'УЧЕНИКИ': <IconGridDots size={18} style={{ opacity: 0.5 }} />,
  'ПЕДАГОГИ ПРЕДМЕТНИКИ': <IconSettings size={18} style={{ opacity: 0.5 }} />,
  'ЛИЧНАЯ ИНФОРМАЦИЯ': <IconGridDots size={18} style={{ opacity: 0.5 }} />,
  'ПАРАЛЛЕЛИ': <IconSettings size={18} style={{ opacity: 0.5 }} />,
};

/* ── Stat Card ── */
interface StatCardProps {
  title: string;
  href: string;
  tabs: { label: string; color: string }[];
  values: number[];
  change: number;
  accentColor: string;
  isLoading?: boolean;
  delay?: number;
}

function StatCard({ title, href, tabs, values, change, accentColor, isLoading, delay = 0 }: StatCardProps) {
  const [activeTab, setActiveTab] = useState(0);
  const isPositive = change > 0;
  const rawValue = values[activeTab] ?? values[0] ?? 0;
  const animatedValue = useCountUp(rawValue, 900);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Paper withBorder>
        {/* Accent top bar */}
        <Box h={3} bg={accentColor} />

        <Box p="md">
          {/* Title row with icon */}
          <Group justify="space-between" align="flex-start" mb={10}>
            <Text
              component={Link}
              href={href}
              size="xs"
              fw={700}
              c="dimmed"
              tt="uppercase"
              lh={1.2}
            >
              {title}
            </Text>
            {CARD_ICONS[title] || <IconGridDots size={18} style={{ opacity: 0.5 }} />}
          </Group>

          {/* Internal tabs */}
          <Group gap={4} mb={14}>
            {tabs.map((tab, i) => (
              <Badge
                key={tab.label}
                size="sm"
                radius="xl"
                variant={activeTab === i ? 'filled' : 'light'}
                color={activeTab === i ? tab.color : 'gray'}
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveTab(i)}
              >
                {tab.label}
              </Badge>
            ))}
          </Group>

          {/* Value + Change */}
          <Group align="flex-end" gap={12}>
            {isLoading ? (
              <Skeleton height={36} width={80} />
            ) : (
              <Text fw={700} lh={1} fz={36} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {animatedValue.toLocaleString('ru-RU')}
              </Text>
            )}
            <Badge
              size="sm"
              variant="light"
              color={isPositive ? 'green' : 'red'}
              mb={6}
              leftSection={
                isPositive ? (
                  <IconArrowUpRight size={12} />
                ) : (
                  <IconArrowDownRight size={12} />
                )
              }
            >
              {isPositive ? '+' : ''}{change}%
            </Badge>
          </Group>

          <Text size="xs" c="dimmed" mt={6}>
            По сравнению с прошлым месяцем
          </Text>
        </Box>
      </Paper>
    </motion.div>
  );
}

/* ── Performance Badge ── */
function PerformanceBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; color: string }> = {
    very_low: { label: 'ОЧЕНЬ НИЗКАЯ', color: 'red' },
    low: { label: 'НИЗКАЯ', color: 'orange' },
    medium: { label: 'СРЕДНЯЯ', color: 'yellow' },
  };
  const c = config[level] ?? { label: level, color: 'gray' };

  return (
    <Badge size="sm" variant="filled" color={c.color} tt="uppercase" fz={10}>
      {c.label}
    </Badge>
  );
}

/* ── Role Badge ── */
function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    'Ученик': 'blue',
    'Педагог': 'green',
    'Родитель': 'pink',
    'Персонал': 'yellow',
  };
  return (
    <Badge size="sm" variant="filled" color={colors[role] || 'cyan'} tt="uppercase">
      {role}
    </Badge>
  );
}

/* ── Time Badge ── */
function TimeBadge({ time, urgent }: { time: string; urgent?: boolean }) {
  const colorMap: Record<string, string> = {
    'СЕГОДНЯ': 'blue',
    'ВЧЕРА': 'yellow',
    'ПОЗАВЧЕРА': 'red',
  };
  const fallbackColor = urgent ? 'red' : 'gray';
  const color = colorMap[time] ?? fallbackColor;

  return (
    <Badge size="sm" variant="light" color={color} tt="uppercase" fz={10}>
      {time}
    </Badge>
  );
}

/* ── Table Skeleton ── */
function TableSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          {Array.from({ length: cols }).map((_, i) => (
            <Table.Th key={i}>
              <Skeleton height={12} width={80} />
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {Array.from({ length: rows }).map((_, ri) => (
          <Table.Tr key={ri}>
            {Array.from({ length: cols }).map((_, ci) => (
              <Table.Td key={ci}>
                <Skeleton height={12} width={ci === 0 ? 60 : 100} />
              </Table.Td>
            ))}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

/* ── Dashboard Page ── */
export default function DashboardPage() {
  const { data, isLoading } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/v1/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      return res.json();
    },
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<{
    success: boolean;
    data: AnalyticsData;
  }>({
    queryKey: ['dashboard-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/v1/dashboard/analytics');
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
  });

  const stats = data?.data?.stats ?? EMPTY_STATS;
  const lowPerformance = data?.data?.lowPerformance ?? [];
  const medicalIssues = data?.data?.medicalIssues ?? [];
  const classByAverage = analyticsData?.data?.classByAverage ?? [];
  const weeklyAttendance = analyticsData?.data?.weeklyAttendance ?? 0;

  return (
    <Stack gap="md">
      {/* ── Stat Cards ── */}
      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md">
        <StatCard
          title="УЧЕНИКИ"
          href="/students"
          tabs={[{ label: 'Всего', color: 'blue' }, { label: 'Сегодня', color: 'teal' }]}
          values={[stats.totalStudents, stats.todayStudents]}
          change={stats.studentsDiff}
          accentColor="var(--mantine-color-blue-6)"
          isLoading={isLoading}
          delay={0}
        />
        <StatCard
          title="ПЕДАГОГИ ПРЕДМЕТНИКИ"
          href="/teachers"
          tabs={[{ label: 'Педагоги', color: 'green' }, { label: 'Персонал', color: 'yellow' }]}
          values={[stats.totalTeachers, stats.totalTeachers]}
          change={stats.teachersDiff}
          accentColor="var(--mantine-color-teal-6)"
          isLoading={isLoading}
          delay={0.08}
        />
        <StatCard
          title="ЛИЧНАЯ ИНФОРМАЦИЯ"
          href="/students"
          tabs={[{ label: 'Классы', color: 'yellow' }, { label: 'Ученики', color: 'blue' }]}
          values={[stats.totalClasses, stats.totalStudents]}
          change={stats.classesDiff}
          accentColor="var(--mantine-color-yellow-6)"
          isLoading={isLoading}
          delay={0.16}
        />
        <StatCard
          title="ПАРАЛЛЕЛИ"
          href="/classes"
          tabs={[{ label: 'Переходы', color: 'pink' }, { label: 'Ушли', color: 'red' }]}
          values={[stats.totalParallels, stats.totalParallels]}
          change={stats.parallelsDiff}
          accentColor="var(--mantine-color-pink-6)"
          isLoading={isLoading}
          delay={0.24}
        />
      </SimpleGrid>

      {/* ── Low Performance Table ── */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }}>
        <Paper withBorder p="md">
          <SectionHeader
            title="Ученики с низкой успеваемостью"
            icon={<IconChartBar size={18} color="var(--mantine-color-blue-6)" />}
            href="/students"
          />
          <Box style={{ overflowX: 'auto' }}>
            {isLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : lowPerformance.length === 0 ? (
              <Box py="xl" ta="center">
                <Text size="sm" c="dimmed">Нет данных</Text>
              </Box>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Класс</Table.Th>
                    <Table.Th>ФИО</Table.Th>
                    <Table.Th>Период</Table.Th>
                    <Table.Th>Предмет</Table.Th>
                    <Table.Th>Успеваемость</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <motion.tbody variants={staggerContainer} initial="initial" animate="animate">
                  {lowPerformance.map((row) => (
                    <motion.tr key={`${row.studentName}-${row.subject}-${row.period}`} variants={staggerRow}>
                      <Table.Td>Класс {row.className}</Table.Td>
                      <Table.Td>{row.studentName}</Table.Td>
                      <Table.Td>{row.period}</Table.Td>
                      <Table.Td>{row.subject}</Table.Td>
                      <Table.Td>
                        <PerformanceBadge level={row.level} />
                      </Table.Td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </Table>
            )}
          </Box>
        </Paper>
      </motion.div>

      {/* ── Medical + Urgent side by side ── */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* Medical */}
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.4 }}>
          <Paper withBorder p="md">
            <SectionHeader
              title="Медицинские вопросы"
              icon={<IconMedicalCross size={18} color="var(--mantine-color-teal-6)" />}
              href="/workspace/medical"
            />
            {isLoading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : medicalIssues.length === 0 ? (
              <Box py="xl" ta="center">
                <Text size="sm" c="dimmed">Нет данных</Text>
              </Box>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>ФИО</Table.Th>
                    <Table.Th>Роль</Table.Th>
                    <Table.Th>Отсутствует</Table.Th>
                    <Table.Th>Причина</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <motion.tbody variants={staggerContainer} initial="initial" animate="animate">
                  {medicalIssues.map((row) => (
                    <motion.tr key={`${row.studentName}-${row.reason}`} variants={staggerRow}>
                      <Table.Td>{row.studentName}</Table.Td>
                      <Table.Td>
                        <RoleBadge role={row.role} />
                      </Table.Td>
                      <Table.Td>
                        {row.daysAbsent} {row.daysAbsent === 1 ? 'день' : row.daysAbsent < 5 ? 'дня' : 'дней'}
                      </Table.Td>
                      <Table.Td>{row.reason}</Table.Td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </Table>
            )}
          </Paper>
        </motion.div>

        {/* Urgent */}
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.5 }}>
          <Paper withBorder p="md">
            <SectionHeader
              title="Срочные вопросы"
              icon={
                <Group gap={0}>
                  <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
                  <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" style={{ marginLeft: -4 }} />
                  <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" style={{ marginLeft: -4 }} />
                </Group>
              }
              href="/urgent-issues"
            />
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Тема</Table.Th>
                  <Table.Th>Роль</Table.Th>
                  <Table.Th>Заявка от</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <motion.tbody variants={staggerContainer} initial="initial" animate="animate">
                {URGENT_DATA.map((row) => (
                  <motion.tr key={`${row.topic}-${row.from}`} variants={staggerRow}>
                    <Table.Td>
                      <Text size="sm">{row.topic}</Text>
                      <Text size="xs" c="dimmed">{row.from}</Text>
                    </Table.Td>
                    <Table.Td>
                      <RoleBadge role={row.role} />
                    </Table.Td>
                    <Table.Td>
                      <TimeBadge time={row.time} urgent={row.urgent} />
                    </Table.Td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </Table>
          </Paper>
        </motion.div>
      </SimpleGrid>

      {/* ── Incidents ── */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.6 }}>
        <Paper withBorder p="md">
          <SectionHeader
            title="Происшествия"
            icon={<IconFlame size={16} color="var(--mantine-color-red-6)" />}
            href="/incidents"
          />
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            {INCIDENTS_DATA.map((item, i) => (
              <motion.div
                key={item.title ?? `incident-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.7 + i * 0.1 }}
              >
                <Paper
                  withBorder
                  p="sm"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor: `var(--mantine-color-${item.color}-6)`,
                  }}
                >
                  <Text size="sm" fw={600} mb={6}>
                    {item.title}
                  </Text>
                  <Text size="xs" c="dimmed" lh={1.5}>
                    {item.description}
                  </Text>
                </Paper>
              </motion.div>
            ))}
          </SimpleGrid>
        </Paper>
      </motion.div>

      {/* ── Analytics ── */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.8 }}>
        <Paper withBorder p="md">
          <Text fw={600} size="sm" mb="sm">Аналитика</Text>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {/* Bar chart: average grade per class */}
            <Paper withBorder p="md">
              <Group gap={8} mb="sm">
                <IconChartBar size={16} color="var(--mantine-color-blue-6)" />
                <Text size="sm" fw={600}>Средняя успеваемость по классам</Text>
              </Group>
              {analyticsLoading ? (
                <Skeleton height={180} />
              ) : classByAverage.length === 0 ? (
                <Box py="xl" ta="center">
                  <Text size="sm" c="dimmed">Нет данных</Text>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={classByAverage}
                    margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="className" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(value) => [Number(value).toFixed(2), 'Средний балл']}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="average" radius={[4, 4, 0, 0]}>
                      {classByAverage.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.average >= 4
                              ? '#40c057'
                              : entry.average >= 3
                              ? '#fab005'
                              : '#fa5252'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Paper>

            {/* Stat: weekly attendance */}
            <Paper withBorder p="md">
              <Group gap={8} mb="sm">
                <IconUsers size={16} color="var(--mantine-color-teal-6)" />
                <Text size="sm" fw={600}>Посещаемость за неделю</Text>
              </Group>
              {analyticsLoading ? (
                <Skeleton height={180} />
              ) : (
                <Box
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 200,
                  }}
                >
                  <Text
                    fw={700}
                    fz={56}
                    c={
                      weeklyAttendance >= 90
                        ? 'green'
                        : weeklyAttendance >= 75
                        ? 'yellow'
                        : 'red'
                    }
                    lh={1}
                  >
                    {weeklyAttendance}%
                  </Text>
                  <Text size="sm" c="dimmed" mt="sm">
                    учеников присутствовали на занятиях
                  </Text>
                  <Badge
                    mt="md"
                    size="lg"
                    variant="light"
                    color={
                      weeklyAttendance >= 90
                        ? 'green'
                        : weeklyAttendance >= 75
                        ? 'yellow'
                        : 'red'
                    }
                  >
                    {weeklyAttendance >= 90
                      ? 'Отличная посещаемость'
                      : weeklyAttendance >= 75
                      ? 'Средняя посещаемость'
                      : 'Низкая посещаемость'}
                  </Badge>
                </Box>
              )}
            </Paper>
          </SimpleGrid>
        </Paper>
      </motion.div>
    </Stack>
  );
}
