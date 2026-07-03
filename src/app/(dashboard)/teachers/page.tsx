'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  RingProgress,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconEdit,
  IconEditOff,
  IconFileSpreadsheet,
  IconGenderFemale,
  IconGenderMale,
  IconLayoutGrid,
  IconLayoutList,
  IconPencil,
  IconSearch,
  IconSend,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

import { exportToExcel } from '@/shared/lib/excel-export';
import { ConfirmDeleteModal } from '@/shared/components/ui/ConfirmDeleteModal';
import { notifications } from '@mantine/notifications';
import { RoleGate } from '@/shared/components/auth/RoleGate';

/* ── Name badge color palette (Mantine color names) ── */
const NAME_COLORS = ['pink', 'orange', 'green', 'blue', 'violet', 'cyan', 'indigo', 'red'];

/* ── Workload ring colors based on hours ── */
function getWorkloadColor(hours: number): string {
  if (hours >= 30) return 'red';
  if (hours >= 20) return 'orange';
  if (hours >= 10) return 'yellow';
  return 'green';
}

/* ── Framer Motion variants ── */
const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
};

/* ── Helpers ── */
function getFullName(t: { lastName: string; firstName: string; middleName?: string | null }) {
  return [t.lastName, t.firstName, t.middleName].filter(Boolean).join(' ');
}

function getShortName(t: { lastName: string; firstName: string; middleName?: string | null }) {
  const f = t.firstName ? `${t.firstName[0]}.` : '';
  const m = t.middleName ? `${t.middleName[0]}.` : '';
  return `${t.lastName} ${f}${m}`;
}

function getInitials(t: { firstName: string; lastName: string }) {
  return `${t.lastName[0] || ''}${t.firstName[0] || ''}`.toUpperCase();
}

function getNameColor(index: number) {
  return NAME_COLORS[index % NAME_COLORS.length];
}

function getYearsLabel(years: number) {
  const lastDigit = years % 10;
  const lastTwo = years % 100;
  if (lastTwo >= 11 && lastTwo <= 19) return `${years} лет`;
  if (lastDigit === 1) return `${years} год`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${years} года`;
  return `${years} лет`;
}

function getExperience(hireDate: string | null) {
  if (!hireDate) return null;
  const years = Math.floor(
    (Date.now() - new Date(hireDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  return Math.max(0, years);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ── Types ── */
interface TeacherSubjectEntry {
  id: string;
  subjectId: string;
  classId: string;
  hoursPerWeek: number;
  subject: { id: string; name: string; color?: string | null };
}

interface TeacherData {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  position?: string | null;
  photo?: string | null;
  hireDate?: string | null;
  email?: string | null;
  isActive: boolean;
  subjects: { id: string; name: string; color?: string | null }[];
  teacherSubjects: TeacherSubjectEntry[];
  curatorOf: { id: string; grade: number; letter: string; level: { id: string; name: string } }[];
  totalHours: number;
}

/* ── Info Cards (top row, matching Figma) ── */
function InfoCardChanges({ teachers }: { teachers: TeacherData[] }) {
  const teacher = teachers[0];
  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
      <Box h={3} bg="var(--mantine-color-blue-6)" />
      <Box p="md">
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={8}>
          Последние изменения
        </Text>
        {teacher ? (
          <Group gap={10}>
            <Avatar size={32} radius="xl" color="bilimosBlue" variant="filled" src={teacher.photo}>
              {getInitials(teacher)}
            </Avatar>
            <Box>
              <Text size="sm" fw={500} lh={1.3}>{getShortName(teacher)}</Text>
              <Text size="xs" c="dimmed" lh={1.3}>{formatDate(teacher.hireDate) || '---'}</Text>
            </Box>
          </Group>
        ) : (
          <Text size="xs" c="dimmed">Нет данных</Text>
        )}
      </Box>
    </Paper>
  );
}

function InfoCardPending({ teachers }: { teachers: TeacherData[] }) {
  const teacher = teachers[1] || teachers[0];
  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
      <Box h={3} bg="var(--mantine-color-yellow-6)" />
      <Box p="md">
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={8}>
          Отправлено на утверждение
        </Text>
        {teacher ? (
          <Group gap={10}>
            <Avatar size={32} radius="xl" color="yellow" variant="filled" src={teacher.photo}>
              <IconSend size={14} />
            </Avatar>
            <Box>
              <Text size="sm" fw={500} lh={1.3}>{getShortName(teacher)}</Text>
            </Box>
          </Group>
        ) : (
          <Text size="xs" c="dimmed">Нет данных</Text>
        )}
      </Box>
    </Paper>
  );
}

function InfoCardApproved({ teachers }: { teachers: TeacherData[] }) {
  const teacher = teachers[2] || teachers[0];
  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
      <Box h={3} bg="var(--mantine-color-green-6)" />
      <Box p="md">
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={8}>
          Утверждено
        </Text>
        {teacher ? (
          <Group gap={10}>
            <Avatar size={32} radius="xl" color="green" variant="filled" src={teacher.photo}>
              <IconCheck size={14} />
            </Avatar>
            <Box>
              <Text size="sm" fw={500} lh={1.3}>{getShortName(teacher)}</Text>
            </Box>
          </Group>
        ) : (
          <Text size="xs" c="dimmed">Нет данных</Text>
        )}
      </Box>
    </Paper>
  );
}

/* ── Filter type ── */
type LevelFilter = '' | 'primary' | 'middle' | 'senior';

/* ── Motion wrappers ── */
const MotionTr = motion.tr;

/* ── Teachers Page ── */
function TeachersContent() {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [activeTab, setActiveTab] = useState<string | null>('general');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('');
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);

  // Удаление педагога с подтверждением
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<TeacherData | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function performDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/teachers/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Не удалось удалить');
      }
      notifications.show({
        title: 'Удалено',
        message: `Педагог ${deleteTarget.lastName} ${deleteTarget.firstName} удалён`,
        color: 'green',
      });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    } catch (e: unknown) {
      notifications.show({
        title: 'Ошибка',
        message: e instanceof Error ? e.message : 'Неизвестная ошибка',
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  }

  const { data, isLoading, error } = useQuery<{ success: boolean; data: TeacherData[] }>({
    queryKey: ['teachers', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/v1/teachers?${params}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  const teachers = data?.data || [];

  const filteredTeachers = levelFilter
    ? teachers.filter((t) => {
        if (!t.teacherSubjects.length) return false;
        return t.teacherSubjects.some((ts) => {
          const cls = t.curatorOf.find((c) => c.id === ts.classId);
          if (!cls) return true;
          if (levelFilter === 'primary') return cls.grade >= 1 && cls.grade <= 4;
          if (levelFilter === 'middle') return cls.grade >= 5 && cls.grade <= 9;
          if (levelFilter === 'senior') return cls.grade >= 10 && cls.grade <= 12;
          return true;
        });
      })
    : teachers;

  function getClassesByLevel(teacher: TeacherData) {
    const primary: string[] = [];
    const senior: string[] = [];
    for (const ts of teacher.teacherSubjects) {
      const cls = teacher.curatorOf.find((c) => c.id === ts.classId);
      if (!cls) continue;
      const label = `${cls.grade}${cls.letter}`;
      if (cls.grade <= 4) {
        if (!primary.includes(label)) primary.push(label);
      } else {
        if (!senior.includes(label)) senior.push(label);
      }
    }
    return { primary, senior };
  }

  const filterButtons: { label: string; value: LevelFilter }[] = [
    { label: 'Начальные', value: 'primary' },
    { label: 'Средние', value: 'middle' },
    { label: 'Старшие', value: 'senior' },
  ];

  function handleExportTeachers() {
    exportToExcel(
      filteredTeachers.map((t, i) => ({
        num: i + 1,
        fullName: getFullName(t),
        position: t.position || 'Педагог',
        subjects: t.subjects.map((s) => s.name).join(', '),
        totalHours: t.totalHours,
        email: t.email || '',
      })),
      [
        { key: 'num', header: 'No' },
        { key: 'fullName', header: 'ФИО' },
        { key: 'position', header: 'Должность' },
        { key: 'subjects', header: 'Предметы' },
        { key: 'totalHours', header: 'Нагрузка (часов)' },
        { key: 'email', header: 'Email' },
      ],
      'Педагоги',
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
          <Text size="xs" c="dimmed">Педагоги предметники</Text>
        </Group>

        {/* Title + Edit button */}
        <Group justify="space-between" align="center">
          <Text fw={700} size="xl">Педагоги предметники</Text>
          <Group gap="sm">
            <Button
              leftSection={<IconFileSpreadsheet size={16} />}
              variant="light"
              color="green"
              size="xs"
              onClick={handleExportTeachers}
              disabled={filteredTeachers.length === 0}
            >
              Экспорт в Excel
            </Button>
            <Button
              leftSection={editMode ? <IconEditOff size={16} /> : <IconEdit size={16} />}
              variant={editMode ? 'filled' : 'outline'}
              color="bilimosBlue"
              size="xs"
              onClick={() => setEditMode((prev) => !prev)}
            >
              {editMode ? 'Завершить' : 'Редактировать'}
            </Button>
          </Group>
        </Group>

        {/* Info cards row */}
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
          <InfoCardChanges teachers={teachers} />
          <InfoCardPending teachers={teachers} />
          <InfoCardApproved teachers={teachers} />
        </SimpleGrid>

        {/* Tabs: Общая нагрузка / Индивидуальная нагрузка */}
        <Tabs value={activeTab} onChange={setActiveTab} color="bilimosBlue">
          <Tabs.List>
            <Tabs.Tab value="general">Общая нагрузка</Tabs.Tab>
            <Tabs.Tab value="individual">Индивидуальная нагрузка</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* Controls row: filter pills + search + view toggle */}
        <Group justify="space-between">
          <Group gap={8}>
            {filterButtons.map((btn) => (
              <Button
                key={btn.value}
                size="xs"
                radius="xl"
                variant={levelFilter === btn.value ? 'filled' : 'light'}
                color="bilimosBlue"
                onClick={() => setLevelFilter(levelFilter === btn.value ? '' : btn.value)}
              >
                {btn.label}
              </Button>
            ))}
          </Group>

          <Group gap="sm">
            <TextInput
              placeholder="Поиск педагога..."
              leftSection={<IconSearch size={16} />}
              size="xs"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              w={220}
            />
            <Group gap={4}>
              <Tooltip label="Таблица" position="bottom" withArrow>
                <ActionIcon
                  variant={viewMode === 'table' ? 'filled' : 'subtle'}
                  color={viewMode === 'table' ? 'bilimosBlue' : 'gray'}
                  size="md"
                  onClick={() => setViewMode('table')}
                >
                  <IconLayoutList size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Карточки" position="bottom" withArrow>
                <ActionIcon
                  variant={viewMode === 'card' ? 'filled' : 'subtle'}
                  color={viewMode === 'card' ? 'bilimosBlue' : 'gray'}
                  size="md"
                  onClick={() => setViewMode('card')}
                >
                  <IconLayoutGrid size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Group>

        {/* Content */}
        {isLoading ? (
          <Box p="xl" ta="center">
            <Loader color="bilimosBlue" />
          </Box>
        ) : error ? (
          <Paper withBorder p="xl" ta="center">
            <Text c="red" size="sm">Ошибка загрузки данных</Text>
          </Paper>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'table' ? (
              /* ── TABLE VIEW (matching Figma 02_педагоги) ── */
              <motion.div
                key="table-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
                  <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w={48} style={{ fontSize: 12 }}>No</Table.Th>
                        <Table.Th style={{ fontSize: 12, minWidth: 200 }}>ФИО</Table.Th>
                        <Table.Th style={{ fontSize: 12 }}>Должность</Table.Th>
                        <Table.Th style={{ fontSize: 12 }}>Предметы</Table.Th>
                        <Table.Th style={{ fontSize: 12 }}>Начальная</Table.Th>
                        <Table.Th style={{ fontSize: 12 }}>Старшая</Table.Th>
                        <Table.Th ta="center" style={{ fontSize: 12 }}>Нагрузка</Table.Th>
                        <Table.Th ta="center" style={{ fontSize: 12 }}>Доп нагрузка</Table.Th>
                        {editMode && <Table.Th ta="center" w={80} style={{ fontSize: 12 }}>Действия</Table.Th>}
                      </Table.Tr>
                    </Table.Thead>
                    <motion.tbody
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                    >
                      {filteredTeachers.map((teacher, index) => {
                        const classes = getClassesByLevel(teacher);
                        const nameColor = getNameColor(index);
                        const workloadColor = getWorkloadColor(teacher.totalHours);
                        return (
                          <MotionTr
                            key={teacher.id}
                            variants={rowVariants}
                            style={{ cursor: 'pointer' }}
                          >
                            <Table.Td c="dimmed" fw={500}>{index + 1}</Table.Td>
                            <Table.Td>
                              <Group gap={10} wrap="nowrap">
                                <Avatar
                                  size={30}
                                  radius="xl"
                                  color={nameColor}
                                  variant="filled"
                                  src={teacher.photo}
                                >
                                  {getInitials(teacher)}
                                </Avatar>
                                <Link href={`/teachers/${teacher.id}`} style={{ textDecoration: 'none' }}>
                                  <Badge
                                    size="md"
                                    variant="light"
                                    color={nameColor}
                                    style={{ textTransform: 'none', cursor: 'pointer' }}
                                  >
                                    {getFullName(teacher)}
                                  </Badge>
                                </Link>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">{teacher.position || 'Педагог'}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4} wrap="wrap">
                                {teacher.subjects.slice(0, 3).map((s) => (
                                  <Badge key={s.id} size="xs" variant="light" color={s.color || 'blue'}>
                                    {s.name}
                                  </Badge>
                                ))}
                                {teacher.subjects.length > 3 && (
                                  <Badge size="xs" variant="light" color="gray">
                                    +{teacher.subjects.length - 3}
                                  </Badge>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4} wrap="wrap">
                                {classes.primary.length > 0
                                  ? classes.primary.map((c) => (
                                      <Text key={c} size="xs" c="dimmed">{c}</Text>
                                    ))
                                  : <Text size="xs" c="dimmed">-</Text>
                                }
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4} wrap="wrap">
                                {classes.senior.length > 0
                                  ? classes.senior.map((c) => (
                                      <Text key={c} size="xs" c="dimmed">{c}</Text>
                                    ))
                                  : <Text size="xs" c="dimmed">-</Text>
                                }
                              </Group>
                            </Table.Td>
                            <Table.Td ta="center">
                              <Tooltip label={`${teacher.totalHours} часов/нед.`} withArrow>
                                <Box style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <RingProgress
                                    size={38}
                                    thickness={4}
                                    roundCaps
                                    sections={[{ value: Math.min(teacher.totalHours / 40 * 100, 100), color: workloadColor }]}
                                    label={
                                      <Text size="xs" ta="center" fw={700} lh={1}>
                                        {teacher.totalHours}
                                      </Text>
                                    }
                                  />
                                </Box>
                              </Tooltip>
                            </Table.Td>
                            <Table.Td ta="center">
                              <Text size="xs" c="dimmed">-</Text>
                            </Table.Td>
                            {editMode && (
                              <Table.Td ta="center">
                                <Group gap={4} justify="center" wrap="nowrap">
                                  <Tooltip label="Редактировать" withArrow position="top">
                                    <ActionIcon
                                      variant="subtle"
                                      color="bilimosBlue"
                                      size="sm"
                                      component={Link}
                                      href={`/teachers/${teacher.id}`}
                                    >
                                      <IconPencil size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Удалить" withArrow position="top">
                                    <ActionIcon
                                      variant="subtle"
                                      color="red"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteTarget(teacher);
                                      }}
                                    >
                                      <IconTrash size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Table.Td>
                            )}
                          </MotionTr>
                        );
                      })}
                      {filteredTeachers.length === 0 && (
                        <tr>
                          <td colSpan={editMode ? 9 : 8}>
                            <Text size="sm" c="dimmed" py="xl" ta="center">
                              Педагоги не найдены
                            </Text>
                          </td>
                        </tr>
                      )}
                    </motion.tbody>
                  </Table>
                </Paper>
              </motion.div>
            ) : (
              /* ── CARD VIEW (matching Figma 05_список_педагогов) ── */
              <motion.div
                key="card-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, lg: 4 }} spacing="md">
                    {filteredTeachers.map((teacher, index) => {
                      const experience = getExperience(teacher.hireDate || null);
                      const nameColor = getNameColor(index);
                      return (
                        <motion.div key={teacher.id} variants={cardVariants}>
                          <Card
                            padding="lg"
                            radius="md"
                            withBorder
                            component={Link}
                            href={`/teachers/${teacher.id}`}
                            style={{
                              cursor: 'pointer',
                              height: '100%',
                              textDecoration: 'none',
                            }}
                          >
                            <Stack gap="sm">
                              {/* Label */}
                              <Text size="xs" c="dimmed" fw={500} tt="uppercase">
                                Педагог
                              </Text>

                              {/* Photo */}
                              <Box ta="center">
                                <Avatar
                                  size={72}
                                  radius="xl"
                                  variant="light"
                                  color={nameColor}
                                  src={teacher.photo}
                                  mx="auto"
                                >
                                  {getInitials(teacher)}
                                </Avatar>
                              </Box>

                              {/* Full name (bold) */}
                              <Text fw={600} size="sm" ta="center" lh={1.3}>
                                {getFullName(teacher)}
                              </Text>

                              {/* Subjects as colored badges */}
                              <Group gap={4} wrap="wrap" justify="center">
                                {teacher.subjects.slice(0, 3).map((s) => (
                                  <Badge key={s.id} size="xs" variant="light" color={s.color || 'blue'}>
                                    {s.name}
                                  </Badge>
                                ))}
                                {teacher.subjects.length > 3 && (
                                  <Badge size="xs" variant="light" color="gray">
                                    +{teacher.subjects.length - 3}
                                  </Badge>
                                )}
                              </Group>

                              {/* Experience line */}
                              <Text size="xs" c="dimmed" ta="center" lh={1.4}>
                                {experience !== null
                                  ? `общ.стаж ${getYearsLabel(experience)}, в нашей ${getYearsLabel(experience)}`
                                  : 'стаж не указан'}
                              </Text>

                              {/* Bottom row: gender icon + date + hours badge */}
                              <Group justify="space-between" mt={4}>
                                <Group gap={6}>
                                  <IconUser size={14} color="var(--mantine-color-dimmed)" />
                                  {teacher.hireDate && (
                                    <Text size="xs" c="dimmed">{formatDate(teacher.hireDate)}</Text>
                                  )}
                                </Group>
                                <Badge size="sm" variant="light" color="pink" fw={700}>
                                  {teacher.totalHours}ч
                                </Badge>
                              </Group>
                            </Stack>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </SimpleGrid>
                </motion.div>

                {filteredTeachers.length === 0 && (
                  <Paper withBorder p="xl" ta="center">
                    <Text size="sm" c="dimmed">Педагоги не найдены</Text>
                  </Paper>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </Stack>
      <ConfirmDeleteModal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={performDelete}
        loading={deleting}
        title="Удалить педагога"
        message={
          deleteTarget
            ? `Удалить ${deleteTarget.lastName} ${deleteTarget.firstName}?`
            : 'Удалить запись?'
        }
        detail="Действие нельзя отменить. Все связанные оценки/расписания останутся в БД, но без привязки."
      />
    </motion.div>
  );
}

export default function TeachersPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary', 'hr']}>
      <TeachersContent />
    </RoleGate>
  );
}
