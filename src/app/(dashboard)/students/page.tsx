'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconBackpack, IconFileSpreadsheet, IconPlus, IconSearch } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

import { exportToExcel } from '@/shared/lib/excel-export';
import { RoleGate } from '@/shared/components/auth/RoleGate';

/* ── Framer Motion variants ── */
const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] as const } },
};

/* ── Types ── */
interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  dateOfBirth: string | null;
  status: 'permanent' | 'conditional' | 'repeating';
  class: {
    id: string;
    grade: number;
    letter: string;
    level: {
      id: string;
      name: string;
    };
  };
}

interface StudentGradeEntry {
  studentId: string;
  value: number;
  category: { weight: number };
}

/* ── Performance filter options ── */
const PERFORMANCE_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'excellent', label: 'Отличники (4.5+)' },
  { value: 'good', label: 'Хорошисты (3.5-4.5)' },
  { value: 'low', label: 'Низкая успеваемость (<3.0)' },
];

/* ── Status config ── */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  permanent: { label: 'Постоянный', color: 'green' },
  conditional: { label: 'Условное', color: 'yellow' },
  repeating: { label: 'Повторное', color: 'orange' },
};

/* ── Level tabs ── */
const LEVEL_TABS = [
  { value: 'all', label: 'Все' },
  { value: 'nach', label: 'Начальная' },
  { value: 'sred', label: 'Средняя' },
  { value: 'star', label: 'Старшая' },
];

function levelTabMatch(levelName: string, tab: string): boolean {
  if (tab === 'all') return true;
  if (tab === 'nach') return levelName.includes('Начальная');
  if (tab === 'sred') return levelName.includes('Средняя');
  if (tab === 'star') return levelName.includes('Старшая');
  return true;
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatClassName(cls: { grade: number; letter: string }): string {
  return `${cls.grade}${cls.letter}`.toUpperCase();
}

function getInitials(s: { firstName: string; lastName: string }) {
  return `${s.lastName[0] || ''}${s.firstName[0] || ''}`.toUpperCase();
}

/* ── Motion wrappers ── */
const MotionTr = motion.tr;

interface ClassSelectItem {
  value: string;
  label: string;
}

function StudentsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  // Класс может прийти из ?classId= (переход «Состав класса» из раздела «Классы»).
  const [classFilter, setClassFilter] = useState<string | null>(
    () => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('classId') : null),
  );
  const [levelTab, setLevelTab] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState<string | null>('all');

  // Add student modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formLastName, setFormLastName] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formMiddleName, setFormMiddleName] = useState('');
  const [formClassId, setFormClassId] = useState<string | null>(null);
  const [formDateOfBirth, setFormDateOfBirth] = useState('');
  const [formStatus, setFormStatus] = useState<string | null>('permanent');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [classSelectItems, setClassSelectItems] = useState<ClassSelectItem[]>([]);

  const { data, isLoading, error } = useQuery<{ success: boolean; data: StudentRow[] }>({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await fetch('/api/v1/students');
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  // Fetch grade data for performance filtering
  const { data: gradesData } = useQuery<{ success: boolean; data: StudentGradeEntry[] }>({
    queryKey: ['students-grades-for-filter'],
    queryFn: async () => {
      const periodsRes = await fetch('/api/v1/periods');
      const periodsJson = await periodsRes.json();
      const activePeriod = periodsJson?.data?.find((p: { isActive?: boolean }) => p.isActive);
      if (!activePeriod) return { success: true, data: [] };
      const res = await fetch(`/api/v1/grading?periodId=${activePeriod.id}`);
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
    enabled: performanceFilter !== 'all',
  });

  // Compute weighted average per student from grade data
  const studentAvgMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!gradesData?.data) return map;
    const totals: Record<string, { weighted: number; weight: number }> = {};
    for (const g of gradesData.data) {
      if (!totals[g.studentId]) totals[g.studentId] = { weighted: 0, weight: 0 };
      totals[g.studentId].weighted += g.value * g.category.weight;
      totals[g.studentId].weight += g.category.weight;
    }
    for (const [id, t] of Object.entries(totals)) {
      if (t.weight > 0) map.set(id, t.weighted / t.weight);
    }
    return map;
  }, [gradesData]);

  function openAddModal() {
    setFormLastName('');
    setFormFirstName('');
    setFormMiddleName('');
    setFormClassId(null);
    setFormDateOfBirth('');
    setFormStatus('permanent');
    setFormError('');
    setAddModalOpen(true);
    fetch('/api/v1/classes')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setClassSelectItems(
            json.data
              .map((c: { id: string; grade: number; letter: string }) => ({
                value: c.id,
                label: `${c.grade}${c.letter}`,
              }))
              .sort((a: ClassSelectItem, b: ClassSelectItem) => a.label.localeCompare(b.label, 'ru')),
          );
        }
      })
      .catch(() => {});
  }

  async function handleAddStudent() {
    if (!formLastName.trim() || !formFirstName.trim() || !formClassId) {
      setFormError('Заполните обязательные поля: Фамилия, Имя, Класс');
      return;
    }
    setFormSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/v1/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          middleName: formMiddleName.trim() || null,
          classId: formClassId,
          dateOfBirth: formDateOfBirth || null,
          status: formStatus || 'permanent',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAddModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['students'] });
      } else {
        setFormError(json.error?.message || 'Ошибка при создании ученика');
      }
    } catch {
      setFormError('Ошибка сети');
    } finally {
      setFormSubmitting(false);
    }
  }

  const students = data?.data || [];

  const classOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of students) {
      const label = formatClassName(s.class);
      if (!seen.has(s.class.id)) {
        seen.set(s.class.id, label);
      }
    }
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (!levelTabMatch(s.class.level.name, levelTab)) return false;
      if (classFilter && s.class.id !== classFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const fullName = `${s.lastName} ${s.firstName} ${s.middleName || ''}`.toLowerCase();
        if (!fullName.includes(q)) return false;
      }
      // Performance filter
      if (performanceFilter && performanceFilter !== 'all') {
        const avg = studentAvgMap.get(s.id);
        if (avg === undefined) return false;
        if (performanceFilter === 'excellent' && avg < 4.5) return false;
        if (performanceFilter === 'good' && (avg < 3.5 || avg >= 4.5)) return false;
        if (performanceFilter === 'low' && avg >= 3.0) return false;
      }
      return true;
    });
  }, [students, levelTab, classFilter, search, performanceFilter, studentAvgMap]);

  function handleExportStudents() {
    exportToExcel(
      filtered.map((s, i) => ({
        num: i + 1,
        fullName: [s.lastName, s.firstName, s.middleName].filter(Boolean).join(' '),
        className: formatClassName(s.class),
        dateOfBirth: formatDate(s.dateOfBirth),
        status: STATUS_MAP[s.status]?.label || s.status,
      })),
      [
        { key: 'num', header: 'No' },
        { key: 'fullName', header: 'ФИО' },
        { key: 'className', header: 'Класс' },
        { key: 'dateOfBirth', header: 'Дата рождения' },
        { key: 'status', header: 'Статус' },
      ],
      'Ученики',
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={pageVariants}>
      <Stack gap="md">
        {/* Breadcrumb */}
        <Group gap={6}>
          <Text component={Link} href="/dashboard" size="xs" c="blue">
            Главная
          </Text>
          <Text size="xs" c="dimmed">/</Text>
          <Text size="xs" c="dimmed">Ученики</Text>
        </Group>

        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap={10}>
            <IconBackpack size={22} color="var(--mantine-color-blue-6)" stroke={1.5} />
            <Title order={3}>Ученики</Title>
            <Badge variant="light" size="lg" color="blue">
              {filtered.length}
            </Badge>
          </Group>
          <Group gap="sm">
            <Button
              leftSection={<IconFileSpreadsheet size={16} />}
              variant="light"
              color="green"
              size="sm"
              onClick={handleExportStudents}
              disabled={filtered.length === 0}
            >
              Экспорт в Excel
            </Button>
            <Button leftSection={<IconPlus size={16} />} size="sm" color="bilimosBlue" onClick={openAddModal}>
              Добавить ученика
            </Button>
          </Group>
        </Group>

        {/* Filters block */}
        <Paper withBorder p="md">
          <Tabs
            value={levelTab}
            onChange={(v) => setLevelTab(v || 'all')}
            color="bilimosBlue"
            mb="md"
          >
            <Tabs.List>
              {LEVEL_TABS.map((tab) => (
                <Tabs.Tab key={tab.value} value={tab.value}>
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>

          <Group gap="sm">
            <TextInput
              placeholder="Поиск по ФИО..."
              leftSection={<IconSearch size={16} />}
              size="sm"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ flex: 1, maxWidth: 350 }}
            />
            <Select
              placeholder="Все классы"
              data={classOptions}
              value={classFilter}
              onChange={setClassFilter}
              clearable
              size="sm"
              w={160}
            />
            <Select
              placeholder="Успеваемость"
              data={PERFORMANCE_OPTIONS}
              value={performanceFilter}
              onChange={setPerformanceFilter}
              size="sm"
              w={220}
            />
          </Group>
        </Paper>

        {/* Table */}
        <Paper withBorder style={{ overflow: 'hidden' }}>
          {isLoading ? (
            <Box p="xl" ta="center">
              <Loader color="bilimosBlue" />
            </Box>
          ) : error ? (
            <Box p="xl" ta="center">
              <Text c="red" size="sm">Ошибка загрузки данных</Text>
            </Box>
          ) : filtered.length === 0 ? (
            <Box p="xl" ta="center">
              <Text c="dimmed" size="sm">Ученики не найдены</Text>
            </Box>
          ) : (
            <Box style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={48}>No</Table.Th>
                    <Table.Th>ФИО</Table.Th>
                    <Table.Th>Класс</Table.Th>
                    <Table.Th>Дата рождения</Table.Th>
                    <Table.Th>Статус</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <motion.tbody
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  key={`${levelTab}-${classFilter}-${search}`}
                >
                  {filtered.map((student, index) => {
                    const statusCfg = STATUS_MAP[student.status] || STATUS_MAP.permanent;
                    const fullName = [student.lastName, student.firstName, student.middleName]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <MotionTr
                        key={student.id}
                        variants={rowVariants}
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/students/${student.id}`)}
                      >
                        <Table.Td c="dimmed" fw={500}>{index + 1}</Table.Td>
                        <Table.Td>
                          <Group gap={10} wrap="nowrap">
                            <Avatar size={28} radius="xl" color="bilimosBlue" variant="filled">
                              {getInitials(student)}
                            </Avatar>
                            <Text size="sm" fw={500}>{fullName}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="sm" color="blue">
                            {formatClassName(student.class)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{formatDate(student.dateOfBirth)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light" color={statusCfg.color}>
                            {statusCfg.label}
                          </Badge>
                        </Table.Td>
                      </MotionTr>
                    );
                  })}
                </motion.tbody>
              </Table>
            </Box>
          )}
        </Paper>

        {/* Add Student Modal */}
        <Modal
          opened={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          title="Добавить ученика"
          centered
        >
          <Stack gap="md">
            <TextInput
              label="Фамилия"
              placeholder="Иванов"
              value={formLastName}
              onChange={(e) => setFormLastName(e.currentTarget.value)}
              required
            />
            <TextInput
              label="Имя"
              placeholder="Иван"
              value={formFirstName}
              onChange={(e) => setFormFirstName(e.currentTarget.value)}
              required
            />
            <TextInput
              label="Отчество"
              placeholder="Иванович"
              value={formMiddleName}
              onChange={(e) => setFormMiddleName(e.currentTarget.value)}
            />
            <Select
              label="Класс"
              placeholder="Выберите класс"
              data={classSelectItems}
              value={formClassId}
              onChange={setFormClassId}
              searchable
              required
            />
            <TextInput
              label="Дата рождения"
              placeholder="2010-05-15"
              value={formDateOfBirth}
              onChange={(e) => setFormDateOfBirth(e.currentTarget.value)}
            />
            <Select
              label="Статус"
              data={[
                { value: 'permanent', label: 'Постоянный' },
                { value: 'conditional', label: 'Условное' },
                { value: 'repeating', label: 'Повторное' },
              ]}
              value={formStatus}
              onChange={setFormStatus}
            />

            {formError && (
              <Text c="red" size="sm">{formError}</Text>
            )}

            <Group justify="flex-end" mt="sm">
              <Button variant="subtle" color="gray" onClick={() => setAddModalOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleAddStudent} loading={formSubmitting}>
                Создать
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </motion.div>
  );
}

export default function StudentsPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'specialist', 'psychologist', 'doctor', 'safeguarding_lead']}>
      <StudentsContent />
    </RoleGate>
  );
}
