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
  Title,
} from '@mantine/core';
import {
  IconChartBar,
  IconChartPie,
  IconTrendingUp,
  IconUsers,
  IconUserStar,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
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
import { RoleGate } from '@/shared/components/auth/RoleGate';

/* ── Types ── */
interface AvgByClass {
  className: string;
  average: number;
  gradeCount: number;
}

interface AvgByTrimester {
  periodName: string;
  average: number;
  gradeCount: number;
}

interface GradeDistItem {
  grade: number;
  count: number;
  label: string;
}

interface TeacherRating {
  teacherId: string;
  teacherName: string;
  average: number;
  gradeCount: number;
}

interface DashAnalytics {
  classByAverage: AvgByClass[];
  weeklyAttendance: number;
  topLowStudents: { name: string; class: string; avg: number }[];
}

/* ── Helpers ── */
function avgColor(avg: number): string {
  if (avg >= 4) return '#40c057';
  if (avg >= 3) return '#fab005';
  return '#fa5252';
}

function avgBadgeColor(avg: number): string {
  if (avg >= 4) return 'green';
  if (avg >= 3) return 'yellow';
  return 'red';
}

const GRADE_COLORS: Record<number, string> = {
  5: '#40c057',
  4: '#228be6',
  3: '#fab005',
  2: '#fa5252',
  1: '#868e96',
};


const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data ?? json;
};

export default function AnalyticsPage() {
  /* ── Queries ── */
  const { data: analytics, isLoading: analyticsLoading } = useQuery<{
    averageByClass: AvgByClass[];
    averageByTrimester: AvgByTrimester[];
    gradeDistribution: GradeDistItem[];
    teacherRatings: TeacherRating[];
  }>({
    queryKey: ['reports-analytics'],
    queryFn: () => fetchJson('/api/v1/reports/analytics'),
  });

  const { data: dashAnalytics, isLoading: dashLoading } = useQuery<DashAnalytics>({
    queryKey: ['dashboard-analytics'],
    queryFn: () => fetchJson('/api/v1/dashboard/analytics'),
  });

  const isLoading = analyticsLoading || dashLoading;

  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch']}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={700} style={{ fontSize: 24, letterSpacing: '-0.02em' }}>Аналитика школы</Text>
            <Text size="sm" c="dimmed" mt={4}>Текущий период · обновлено сегодня</Text>
          </div>
        </Group>

          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader size="lg" />
            </Group>
          ) : (
            <>
              {/* ── Row 1: Class averages + Weekly attendance ── */}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {/* Bar chart: average grade per class */}
                <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                  <Group gap={8} mb="md">
                    <IconChartBar size={20} color="var(--mantine-color-blue-6)" />
                    <Text fw={600}>Средняя успеваемость по классам</Text>
                  </Group>
                  {analytics && analytics.averageByClass.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={analytics.averageByClass}
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
                          {analytics.averageByClass.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={avgColor(entry.average)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Text ta="center" c="dimmed" py="xl">Нет данных</Text>
                  )}
                </Paper>

                {/* Weekly attendance */}
                <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                  <Group gap={8} mb="md">
                    <IconUsers size={20} color="var(--mantine-color-teal-6)" />
                    <Text fw={600}>Посещаемость за неделю</Text>
                  </Group>
                  <Box
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 230,
                    }}
                  >
                    <Text
                      fw={700}
                      fz={56}
                      c={avgBadgeColor(((dashAnalytics?.weeklyAttendance ?? 0) / 100) * 5)}
                      lh={1}
                    >
                      {dashAnalytics?.weeklyAttendance ?? 0}%
                    </Text>
                    <Text size="sm" c="dimmed" mt="sm">
                      учеников присутствовали на занятиях
                    </Text>
                    <Badge
                      mt="md"
                      size="lg"
                      variant="light"
                      color={
                        (dashAnalytics?.weeklyAttendance ?? 0) >= 90
                          ? 'green'
                          : (dashAnalytics?.weeklyAttendance ?? 0) >= 75
                          ? 'yellow'
                          : 'red'
                      }
                    >
                      {(dashAnalytics?.weeklyAttendance ?? 0) >= 90
                        ? 'Отличная посещаемость'
                        : (dashAnalytics?.weeklyAttendance ?? 0) >= 75
                        ? 'Средняя посещаемость'
                        : 'Низкая посещаемость'}
                    </Badge>
                  </Box>
                </Paper>
              </SimpleGrid>

              {/* ── Row 2: Grade distribution + Trimester dynamics ── */}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {/* Grade distribution */}
                <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                  <Group gap={8} mb="md">
                    <IconChartPie size={20} color="var(--mantine-color-violet-6)" />
                    <Text fw={600}>Распределение оценок</Text>
                  </Group>
                  {analytics && analytics.gradeDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={analytics.gradeDistribution}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          formatter={(value, _name, props) => [
                            value,
                            `Оценка ${props.payload.grade}`,
                          ]}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {analytics.gradeDistribution.map((entry) => (
                            <Cell
                              key={`dist-${entry.grade}`}
                              fill={GRADE_COLORS[entry.grade] ?? '#868e96'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Text ta="center" c="dimmed" py="xl">Нет данных</Text>
                  )}
                </Paper>

                {/* Trimester dynamics */}
                <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                  <Group gap={8} mb="md">
                    <IconTrendingUp size={20} color="var(--mantine-color-orange-6)" />
                    <Text fw={600}>Динамика по триместрам</Text>
                  </Group>
                  {analytics && analytics.averageByTrimester.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={analytics.averageByTrimester}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="periodName" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          formatter={(value) => [Number(value).toFixed(2), 'Средний балл']}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar dataKey="average" fill="#228be6" radius={[4, 4, 0, 0]}>
                          {analytics.averageByTrimester.map((entry, index) => (
                            <Cell key={`trim-${index}`} fill={avgColor(entry.average)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Text ta="center" c="dimmed" py="xl">Нет данных</Text>
                  )}
                </Paper>
              </SimpleGrid>

              {/* ── Row 3: Teacher ratings + Low students ── */}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {/* Teacher ratings */}
                <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                  <Group gap={8} mb="md">
                    <IconUserStar size={20} color="var(--mantine-color-indigo-6)" />
                    <Text fw={600}>Рейтинг учителей по успеваемости</Text>
                  </Group>
                  {analytics && analytics.teacherRatings.length > 0 ? (
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>ФИО</Table.Th>
                          <Table.Th ta="center">Ср. балл</Table.Th>
                          <Table.Th ta="center">Оценок</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {analytics.teacherRatings.map((t) => (
                          <Table.Tr key={t.teacherId}>
                            <Table.Td fw={500}>{t.teacherName}</Table.Td>
                            <Table.Td ta="center">
                              <Badge color={avgBadgeColor(t.average)} variant="filled">
                                {t.average.toFixed(2)}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="center">{t.gradeCount}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text ta="center" c="dimmed" py="xl">Нет данных</Text>
                  )}
                </Paper>

                {/* Low-performing students */}
                <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                  <Group gap={8} mb="md">
                    <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
                    <Text fw={600}>Ученики с низкой успеваемостью</Text>
                  </Group>
                  {dashAnalytics && dashAnalytics.topLowStudents.length > 0 ? (
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>ФИО</Table.Th>
                          <Table.Th ta="center">Класс</Table.Th>
                          <Table.Th ta="center">Ср. балл</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {dashAnalytics.topLowStudents.map((s, i) => (
                          <Table.Tr key={i}>
                            <Table.Td fw={500}>{s.name}</Table.Td>
                            <Table.Td ta="center">{s.class}</Table.Td>
                            <Table.Td ta="center">
                              <Badge color="red" variant="filled">
                                {s.avg.toFixed(2)}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text ta="center" c="dimmed" py="xl">Нет данных</Text>
                  )}
                </Paper>
              </SimpleGrid>
            </>
          )}
        </Stack>
      </Stack>
    </RoleGate>
  );
}
