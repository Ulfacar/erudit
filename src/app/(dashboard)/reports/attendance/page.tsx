'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCalendarStats, IconFileSpreadsheet } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { RoleGate } from '@/shared/components/auth/RoleGate';
import { exportToExcel } from '@/shared/lib/excel-export';

/* ── Types ── */
interface AttendanceRow {
  studentId: string;
  studentName: string;
  daysPresent: number;
  daysAbsent: number;
  daysExcused: number;
  daysLate: number;
  daysTrip: number;
  daysQuarantine: number;
  attendancePercent: number;
}

interface AttendanceSummary {
  totalStudents: number;
  totalSchoolDays: number;
  avgPresent: number;
  avgAbsent: number;
  avgExcused: number;
  avgLate: number;
  avgAttendancePercent: number;
}

interface ClassOption {
  id: string;
  grade: number;
  letter: string;
}

/* ── Helpers ── */
function pctColor(pct: number): string {
  if (pct >= 90) return 'green';
  if (pct >= 75) return 'yellow';
  return 'red';
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data ?? json;
};

export default function AttendanceReportPage() {
  const [classId, setClassId] = useState<string | null>(null);

  // Default: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(toISODate(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(toISODate(today));

  /* ── Data queries ── */
  const { data: classes = [] } = useQuery<ClassOption[]>({
    queryKey: ['classes'],
    queryFn: () => fetchJson('/api/v1/classes'),
  });

  const { data: report, isLoading } = useQuery<{
    rows: AttendanceRow[];
    summary: AttendanceSummary;
    totalSchoolDays: number;
  }>({
    queryKey: ['report-attendance', classId, startDate, endDate],
    queryFn: () =>
      fetchJson(
        `/api/v1/reports/attendance?classId=${classId}&startDate=${startDate}&endDate=${endDate}`,
      ),
    enabled: Boolean(classId && startDate && endDate),
  });

  const classOptions = classes
    .sort((a: ClassOption, b: ClassOption) => a.grade - b.grade || a.letter.localeCompare(b.letter))
    .map((c: ClassOption) => ({ value: c.id, label: `${c.grade}${c.letter}` }));

  /* ── Excel export ── */
  function handleExport() {
    if (!report) return;
    const columns = [
      { key: 'num', header: '№' },
      { key: 'studentName', header: 'ФИО' },
      { key: 'daysPresent', header: 'Присутствовал' },
      { key: 'daysAbsent', header: 'Отсутствовал' },
      { key: 'daysExcused', header: 'Уважит.' },
      { key: 'daysLate', header: 'Опоздал' },
      { key: 'daysTrip', header: 'Выезд' },
      { key: 'daysQuarantine', header: 'Карантин' },
      { key: 'attendancePercent', header: '% посещ.' },
    ];

    const data = report.rows.map((row, i) => ({
      num: i + 1,
      ...row,
    }));

    exportToExcel(data, columns, 'Отчёт_по_посещаемости');
  }

  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'curator', 'teacher']}>
      <motion.div variants={pageVariants} initial="hidden" animate="visible">
        <Stack gap="lg">
          <Group justify="space-between">
            <Group gap="sm">
              <IconCalendarStats size={28} />
              <Title order={2}>Отчёт по посещаемости</Title>
            </Group>
            {report && report.rows.length > 0 && (
              <Button
                leftSection={<IconFileSpreadsheet size={16} />}
                variant="light"
                onClick={handleExport}
              >
                Экспорт в Excel
              </Button>
            )}
          </Group>

          {/* ── Filters ── */}
          <Paper p="md" radius="md" withBorder>
            <Group grow>
              <Select
                label="Класс"
                placeholder="Выберите класс"
                data={classOptions}
                value={classId}
                onChange={setClassId}
                searchable
                clearable
              />
              <TextInput
                label="Начало периода"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.currentTarget.value)}
              />
              <TextInput
                label="Конец периода"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.currentTarget.value)}
              />
            </Group>
            {report && (
              <Text size="sm" c="dimmed" mt="xs">
                Учебных дней в периоде: {report.totalSchoolDays}
              </Text>
            )}
          </Paper>

          {/* ── Content ── */}
          {!classId ? (
            <Paper p="xl" radius="md" withBorder>
              <Text ta="center" c="dimmed" size="lg">
                Выберите класс для формирования отчёта
              </Text>
            </Paper>
          ) : isLoading ? (
            <Group justify="center" py="xl">
              <Loader size="lg" />
            </Group>
          ) : !report || report.rows.length === 0 ? (
            <Paper p="xl" radius="md" withBorder>
              <Text ta="center" c="dimmed" size="lg">
                Нет данных по выбранным параметрам
              </Text>
            </Paper>
          ) : (
            <Paper p="md" radius="md" withBorder>
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={40}>№</Table.Th>
                      <Table.Th miw={200}>ФИО</Table.Th>
                      <Table.Th ta="center">Присутствовал</Table.Th>
                      <Table.Th ta="center">Отсутствовал</Table.Th>
                      <Table.Th ta="center">Уважит.</Table.Th>
                      <Table.Th ta="center">Опоздал</Table.Th>
                      <Table.Th ta="center">Выезд</Table.Th>
                      <Table.Th ta="center">Карантин</Table.Th>
                      <Table.Th ta="center">% посещ.</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {report.rows.map((row, i) => (
                      <Table.Tr key={row.studentId}>
                        <Table.Td>{i + 1}</Table.Td>
                        <Table.Td fw={500}>{row.studentName}</Table.Td>
                        <Table.Td ta="center">{row.daysPresent}</Table.Td>
                        <Table.Td ta="center">
                          {row.daysAbsent > 0 ? (
                            <Badge color="red" variant="light">{row.daysAbsent}</Badge>
                          ) : (
                            '0'
                          )}
                        </Table.Td>
                        <Table.Td ta="center">{row.daysExcused}</Table.Td>
                        <Table.Td ta="center">
                          {row.daysLate > 0 ? (
                            <Badge color="yellow" variant="light">{row.daysLate}</Badge>
                          ) : (
                            '0'
                          )}
                        </Table.Td>
                        <Table.Td ta="center">{row.daysTrip}</Table.Td>
                        <Table.Td ta="center">{row.daysQuarantine}</Table.Td>
                        <Table.Td ta="center">
                          <Badge
                            size="lg"
                            color={pctColor(row.attendancePercent)}
                            variant="filled"
                          >
                            {row.attendancePercent}%
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}

                    {/* Summary row */}
                    <Table.Tr style={{ fontWeight: 700 }}>
                      <Table.Td />
                      <Table.Td>Средние показатели</Table.Td>
                      <Table.Td ta="center">{report.summary.avgPresent}</Table.Td>
                      <Table.Td ta="center">{report.summary.avgAbsent}</Table.Td>
                      <Table.Td ta="center">{report.summary.avgExcused}</Table.Td>
                      <Table.Td ta="center">{report.summary.avgLate}</Table.Td>
                      <Table.Td ta="center" />
                      <Table.Td ta="center" />
                      <Table.Td ta="center">
                        <Badge
                          size="lg"
                          color={pctColor(report.summary.avgAttendancePercent)}
                          variant="filled"
                        >
                          {report.summary.avgAttendancePercent}%
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>
          )}
        </Stack>
      </motion.div>
    </RoleGate>
  );
}
