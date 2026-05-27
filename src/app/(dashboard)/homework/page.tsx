'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { IconBook2, IconPlus } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { motion } from 'framer-motion';

import { useMe } from '@/shared/hooks/useMe';

/* ── Types ── */
interface HomeworkItem {
  id: string;
  description: string;
  dueDate: string;
  class: { id: string; grade: number; letter: string };
  subject: { id: string; name: string };
  teacher: { id: string; firstName: string; lastName: string };
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

const STAFF_ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'secretary'];

export default function HomeworkPage() {
  const { me } = useMe();
  const queryClient = useQueryClient();

  const isStaff = me && STAFF_ROLES.includes(me.role);
  const isTeacher = me && ['teacher', 'curator', 'zavuch', 'super_admin'].includes(me.role);

  const isParent = me?.role === 'parent';
  const [parentChildId, setParentChildId] = useState<string | null>(null);

  // Auto-filter for students/parents
  const activeChild = isParent
    ? me?.children?.find((c) => c.studentId === parentChildId) ?? me?.children?.[0]
    : null;
  const autoClassId = me?.student?.classId ?? activeChild?.classId ?? null;
  const activeChildName = activeChild ? `${activeChild.lastName} ${activeChild.firstName}` : null;

  const [classId, setClassId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [formClassId, setFormClassId] = useState<string | null>(null);
  const [formSubjectId, setFormSubjectId] = useState<string | null>(null);
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

  const effectiveClassId = isStaff ? classId : autoClassId;

  /* ── Queries ── */
  const { data: classes = [] } = useQuery<ClassOption[]>({
    queryKey: ['classes'],
    queryFn: () => fetchJson('/api/v1/classes'),
    enabled: isStaff === true,
  });

  const { data: subjects = [] } = useQuery<SubjectOption[]>({
    queryKey: ['grading-subjects', effectiveClassId],
    queryFn: () => fetchJson(`/api/v1/grading/subjects?classId=${effectiveClassId}`),
    enabled: Boolean(effectiveClassId),
  });

  const params = new URLSearchParams();
  if (effectiveClassId) params.set('classId', effectiveClassId);
  if (subjectId) params.set('subjectId', subjectId);

  const { data: homework = [], isLoading } = useQuery<HomeworkItem[]>({
    queryKey: ['homework', effectiveClassId, subjectId],
    queryFn: () => fetchJson(`/api/v1/homework?${params.toString()}`),
    enabled: Boolean(effectiveClassId) || isStaff === true,
  });

  /* ── Create mutation ── */
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: formClassId,
          subjectId: formSubjectId,
          teacherId: me?.teacherId,
          description: formDescription,
          dueDate: formDueDate,
        }),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      setModalOpen(false);
      setFormClassId(null);
      setFormSubjectId(null);
      setFormDescription('');
      setFormDueDate('');
      notifications.show({
        title: 'Готово',
        message: 'Домашнее задание создано',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось создать задание',
        color: 'red',
      });
    },
  });

  const classOptions = classes
    .sort((a: ClassOption, b: ClassOption) => a.grade - b.grade || a.letter.localeCompare(b.letter))
    .map((c: ClassOption) => ({ value: c.id, label: `${c.grade}${c.letter}` }));

  const subjectOptions = subjects.map((s: SubjectOption) => ({ value: s.id, label: s.name }));

  const now = new Date();

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <Stack gap="lg">
        <Group justify="space-between">
          <Group gap="sm">
            <IconBook2 size={28} />
            <Title order={2}>Домашние задания</Title>
          </Group>
          {activeChildName && !isStaff && (
            <Badge size="lg" variant="light" color="blue">{activeChildName}</Badge>
          )}
          {isTeacher && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>
              Добавить задание
            </Button>
          )}
        </Group>

        {/* ── Parent child switcher ── */}
        {isParent && me?.children && me.children.length > 1 && (
          <Select
            label="Ребёнок"
            data={me.children.map((c) => ({
              value: c.studentId,
              label: `${c.lastName} ${c.firstName}${c.className ? ` · ${c.className}` : ''}`,
            }))}
            value={parentChildId ?? me.children[0]?.studentId}
            onChange={setParentChildId}
            allowDeselect={false}
            w={280}
          />
        )}

        {/* ── Filters (staff only) ── */}
        {isStaff && (
          <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
            <Group grow>
              <Select
                label="Класс"
                placeholder="Все классы"
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
                placeholder={effectiveClassId ? 'Все предметы' : 'Сначала выберите класс'}
                data={subjectOptions}
                value={subjectId}
                onChange={setSubjectId}
                disabled={!effectiveClassId}
                searchable
                clearable
              />
            </Group>
          </Paper>
        )}

        {/* ── Content ── */}
        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader size="lg" />
          </Group>
        ) : homework.length === 0 ? (
          <Paper p="xl" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
            <Text ta="center" c="dimmed" size="lg">
              {effectiveClassId || isStaff
                ? 'Нет домашних заданий'
                : 'Выберите класс для просмотра заданий'}
            </Text>
          </Paper>
        ) : (
          <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee', overflow: 'auto' }}>
            <Table striped highlightOnHover style={{ minWidth: 600 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Предмет</Table.Th>
                  <Table.Th>Класс</Table.Th>
                  <Table.Th>Учитель</Table.Th>
                  <Table.Th miw={250}>Задание</Table.Th>
                  <Table.Th ta="center">Срок сдачи</Table.Th>
                  <Table.Th ta="center">Статус</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {homework.map((hw) => {
                  const due = new Date(hw.dueDate);
                  const overdue = due < now;
                  return (
                    <Table.Tr key={hw.id}>
                      <Table.Td fw={500}>{hw.subject.name}</Table.Td>
                      <Table.Td>{hw.class.grade}{hw.class.letter}</Table.Td>
                      <Table.Td>{hw.teacher.lastName} {hw.teacher.firstName}</Table.Td>
                      <Table.Td>{hw.description}</Table.Td>
                      <Table.Td ta="center">
                        {due.toLocaleDateString('ru-RU')}
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge color={overdue ? 'red' : 'green'} variant="light">
                          {overdue ? 'Просрочено' : 'Актуально'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>

      {/* ── Create Modal ── */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Новое домашнее задание"
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Класс"
            placeholder="Выберите класс"
            data={classOptions}
            value={formClassId}
            onChange={setFormClassId}
            searchable
            required
          />
          <Select
            label="Предмет"
            placeholder="Выберите предмет"
            data={subjectOptions}
            value={formSubjectId}
            onChange={setFormSubjectId}
            searchable
            required
          />
          <Textarea
            label="Описание задания"
            placeholder="Опишите задание..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.currentTarget.value)}
            minRows={3}
            required
          />
          <TextInput
            label="Срок сдачи"
            type="date"
            value={formDueDate}
            onChange={(e) => setFormDueDate(e.currentTarget.value)}
            required
          />
          <Button
            onClick={() => createMutation.mutate()}
            loading={createMutation.isPending}
            disabled={!formClassId || !formSubjectId || !formDescription || !formDueDate}
          >
            Создать задание
          </Button>
        </Stack>
      </Modal>
    </motion.div>
  );
}
