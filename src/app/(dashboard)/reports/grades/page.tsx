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
  Title,
} from '@mantine/core';
import { IconFileSpreadsheet, IconReportAnalytics } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { RoleGate } from '@/shared/components/auth/RoleGate';
import { exportToExcel } from '@/shared/lib/excel-export';

/* ── Types ── */
interface Category {
  id: string;
  name: string;
  weight: number;
}

interface GradeRow {
  studentId: string;
  studentName: string;
  categoryGrades: Record<string, { grades: number[]; average: number }>;
  weightedAverage: number;
  gradeCount: number;
}

interface ClassOption {
  id: string;
  grade: number;
  letter: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

interface PeriodOption {
  id: string;
  name: string;
  isActive: boolean;
}

/* ── Helpers ── */
function avgColor(avg: number): string {
  if (avg >= 4) return 'green';
  if (avg >= 3) return 'yellow';
  if (avg > 0) return 'red';
  return 'gray';
}

const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/* ── Fetchers ── */
const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data ?? json;
};

export default function GradesReportPage() {
  const [classId, setClassId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);

  /* ── Data queries ── */
  const { data: classes = [] } = useQuery<ClassOption[]>({
    queryKey: ['classes'],
    queryFn: () => fetchJson('/api/v1/classes'),
  });

  const { data: subjects = [] } = useQuery<SubjectOption[]>({
    queryKey: ['grading-subjects', classId],
    queryFn: () => fetchJson(`/api/v1/grading/subjects?classId=${classId}`),
    enabled: Boolean(classId),
  });

  const { data: periods = [] } = useQuery<PeriodOption[]>({
    queryKey: ['periods'],
    queryFn: () => fetchJson('/api/v1/periods'),
  });

  const {
    data: report,
    isLoading,
  } = useQuery<{ categories: Category[]; rows: GradeRow[]; classAverage: number }>({
    queryKey: ['report-grades', classId, subjectId, periodId],
    queryFn: () =>
      fetchJson(
        `/api/v1/reports/grades?classId=${classId}&subjectId=${subjectId}&periodId=${periodId}`,
      ),
    enabled: Boolean(classId && subjectId && periodId),
  });

  /* Auto-select active period */
  const activePeriod = periods.find((p) => p.isActive);
  if (activePeriod && !periodId) {
    setPeriodId(activePeriod.id);
  }

  /* ── Select options ── */
  const classOptions = classes
    .sort((a: ClassOption, b: ClassOption) => a.grade - b.grade || a.letter.localeCompare(b.letter))
    .map((c: ClassOption) => ({ value: c.id, label: `${c.grade}${c.letter}` }));

  const subjectOptions = subjects.map((s: SubjectOption) => ({ value: s.id, label: s.name }));

  const periodOptions = periods.map((p: PeriodOption) => ({
    value: p.id,
    label: p.isActive ? `${p.name} (текущий)` : p.name,
  }));

  /* ── Excel export ── */
  function handleExport() {
    if (!report) return;
    const columns = [
      { key: 'num', header: '№' },
      { key: 'studentName', header: 'ФИО' },
      ...report.categories.map((c) => ({ key: `cat_${c.id}`, header: c.name })),
      { key: 'weightedAverage', header: 'Ср. взвеш.' },
    ];

    const data = report.rows.map((row, i) => {
      const obj: Record<string, unknown> = {
        num: i + 1,
        studentName: row.studentName,
        weightedAverage: row.weightedAverage || '—',
      };
      for (const cat of report.categories) {
        const cg = row.categoryGrades[cat.id];
        obj[`cat_${cat.id}`] = cg?.grades.length ? cg.grades.join(', ') : '—';
      }
      return obj;
    });

    exportToExcel(data, columns, 'Отчёт_по_оценкам');
  }

  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'curator', 'teacher']}>
      <motion.div variants={pageVariants} initial="hidden" animate="visible">
        <Stack gap="lg">
          <Group justify="space-between">
            <Group gap="sm">
              <IconReportAnalytics size={28} />
              <Title order={2}>Отчёт по оценкам</Title>
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
                onChange={(val) => {
                  setClassId(val);
                  setSubjectId(null);
                }}
                searchable
                clearable
              />
              <Select
                label="Предмет"
                placeholder={classId ? 'Выберите предмет' : 'Сначала выберите класс'}
                data={subjectOptions}
                value={subjectId}
                onChange={setSubjectId}
                disabled={!classId}
                searchable
                clearable
              />
              <Select
                label="Период"
                placeholder="Выберите период"
                data={periodOptions}
                value={periodId}
                onChange={setPeriodId}
                clearable
              />
            </Group>
          </Paper>

          {/* ── Content ── */}
          {!classId || !subjectId || !periodId ? (
            <Paper p="xl" radius="md" withBorder>
              <Text ta="center" c="dimmed" size="lg">
                Выберите класс, предмет и период для формирования отчёта
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
                      {report.categories.map((cat) => (
                        <Table.Th key={cat.id} ta="center" miw={120}>
                          {cat.name}
                          <Text size="xs" c="dimmed">вес: {cat.weight}</Text>
                        </Table.Th>
                      ))}
                      <Table.Th ta="center" miw={100}>Ср. взвеш.</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {report.rows.map((row, i) => (
                      <Table.Tr key={row.studentId}>
                        <Table.Td>{i + 1}</Table.Td>
                        <Table.Td fw={500}>{row.studentName}</Table.Td>
                        {report.categories.map((cat) => {
                          const cg = row.categoryGrades[cat.id];
                          return (
                            <Table.Td key={cat.id} ta="center">
                              {cg && cg.grades.length > 0 ? (
                                <Stack gap={2} align="center">
                                  <Text size="sm">{cg.grades.join(', ')}</Text>
                                  <Badge size="xs" color={avgColor(cg.average)} variant="light">
                                    {cg.average.toFixed(2)}
                                  </Badge>
                                </Stack>
                              ) : (
                                <Text size="sm" c="dimmed">—</Text>
                              )}
                            </Table.Td>
                          );
                        })}
                        <Table.Td ta="center">
                          {row.weightedAverage > 0 ? (
                            <Badge size="lg" color={avgColor(row.weightedAverage)} variant="filled">
                              {row.weightedAverage.toFixed(2)}
                            </Badge>
                          ) : (
                            <Text size="sm" c="dimmed">—</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}

                    {/* Summary row */}
                    <Table.Tr style={{ fontWeight: 700 }}>
                      <Table.Td />
                      <Table.Td>Средний по классу</Table.Td>
                      {report.categories.map((cat) => (
                        <Table.Td key={cat.id} />
                      ))}
                      <Table.Td ta="center">
                        <Badge size="lg" color={avgColor(report.classAverage)} variant="filled">
                          {report.classAverage.toFixed(2)}
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
