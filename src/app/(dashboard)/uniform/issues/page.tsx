'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconHanger2, IconSend, IconX } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['uniform_manager', 'super_admin'] as const;

type UniformItem = { id: string; name: string; category: string | null; basic: boolean; price: number | null };
type Variant = { id: string; size: string; total: number; available: number };
type ClassRow = { id: string; grade: number; letter: string };
type Student = { id: string; firstName: string; lastName: string; middleName?: string | null; classId: string | null; class?: { grade: number; letter: string } | null };
type Issue = {
  id: string;
  itemId: string;
  item: { name: string };
  size: string;
  studentId: string;
  className: string | null;
  paid: boolean;
  amount: number | null;
  status: string | null;
  note: string | null;
  issuedAt: string;
};

function className(cls?: { grade: number; letter: string } | null) {
  return cls ? `${cls.grade}${cls.letter}` : '';
}

function studentName(student?: Student | null) {
  if (!student) return '—';
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function UniformIssuesContent() {
  const [items, setItems] = useState<UniformItem[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemId, setItemId] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [amount, setAmount] = useState<number | string>(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const studentsById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const selectedClass = classes.find((row) => row.id === classId) ?? null;
  const selectedClassName = selectedClass ? `${selectedClass.grade}${selectedClass.letter}` : '';
  const selectedItem = items.find((item) => item.id === itemId) ?? null;

  const classOptions = classes.map((row) => ({ value: row.id, label: `${row.grade}${row.letter}` }));
  const studentOptions = students
    .filter((student) => !classId || student.classId === classId)
    .map((student) => ({ value: student.id, label: `${studentName(student)}${className(student.class) ? ` · ${className(student.class)}` : ''}` }));
  const itemOptions = items.map((item) => ({ value: item.id, label: item.name }));
  const sizeOptions = variants.map((variant) => ({
    value: variant.size,
    label: `${variant.size} · осталось ${variant.available}`,
    disabled: variant.available <= 0,
  }));

  async function loadIssues() {
    const json = await fetch('/api/v1/uniform/issues').then((r) => r.json());
    if (json.success) setIssues(json.data ?? []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [itemsJson, classesJson, studentsJson, issuesJson] = await Promise.all([
          fetch('/api/v1/uniform/items').then((r) => r.json()),
          fetch('/api/v1/classes').then((r) => r.json()),
          fetch('/api/v1/students').then((r) => r.json()),
          fetch('/api/v1/uniform/issues').then((r) => r.json()),
        ]);
        if (itemsJson.success) setItems(itemsJson.data ?? []);
        if (classesJson.success) setClasses(classesJson.data ?? []);
        if (studentsJson.success) setStudents(studentsJson.data ?? []);
        if (issuesJson.success) setIssues(issuesJson.data ?? []);
      } catch {
        notifications.show({ color: 'red', title: 'Ошибка сети', message: 'Не удалось загрузить выдачу' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setSize(null);
    if (!itemId) {
      setVariants([]);
      return;
    }
    fetch(`/api/v1/uniform/items/${itemId}/variants`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setVariants(json.data ?? []);
      })
      .catch(() => setVariants([]));
  }, [itemId]);

  useEffect(() => {
    setStudentId(null);
  }, [classId]);

  async function submit() {
    if (!itemId || !size || !studentId || !selectedClassName) {
      notifications.show({ color: 'red', title: 'Ошибка', message: 'Выберите товар, размер, класс и ученика' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/uniform/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          size,
          studentId,
          className: selectedClassName,
          paid,
          amount: paid ? Number(amount || 0) : 0,
          note: note.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось выдать форму');

      notifications.show({ color: 'green', title: 'Готово', message: 'Выдача сохранена' });
      setSize(null);
      setStudentId(null);
      setPaid(false);
      setAmount(0);
      setNote('');
      await Promise.all([
        loadIssues(),
        itemId
          ? fetch(`/api/v1/uniform/items/${itemId}/variants`).then((r) => r.json()).then((v) => { if (v.success) setVariants(v.data ?? []); })
          : Promise.resolve(),
      ]);
    } catch (error) {
      notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось выдать форму' });
    } finally {
      setSubmitting(false);
    }
  }

  async function processReservation(id: string, action: 'confirm' | 'cancel') {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/uniform/issues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось обработать бронь');

      notifications.show({
        color: 'green',
        title: 'Готово',
        message: action === 'confirm' ? 'Бронь подтверждена' : 'Бронь отменена',
      });
      await Promise.all([
        loadIssues(),
        itemId
          ? fetch(`/api/v1/uniform/items/${itemId}/variants`).then((r) => r.json()).then((v) => { if (v.success) setVariants(v.data ?? []); })
          : Promise.resolve(),
      ]);
    } catch (error) {
      notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось обработать бронь' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack gap="md">
      <Group gap="xs">
        <IconHanger2 size={24} color="#e8590c" />
        <Title order={3}>Выдача формы</Title>
      </Group>

      <Paper withBorder radius="sm" p="md">
        <Stack gap="sm">
          <Group grow align="flex-end">
            <Select label="Товар" searchable data={itemOptions} value={itemId} onChange={setItemId} />
            <Select label="Размер" searchable data={sizeOptions} value={size} onChange={setSize} disabled={!itemId} />
          </Group>
          <Group grow align="flex-end">
            <Select label="Класс" searchable data={classOptions} value={classId} onChange={setClassId} />
            <Select label="Ученик" searchable data={studentOptions} value={studentId} onChange={setStudentId} disabled={!classId} />
          </Group>
          <Group align="flex-end">
            <Checkbox label="Платно" checked={paid} onChange={(event) => setPaid(event.currentTarget.checked)} />
            {paid && <NumberInput label="Сумма, сом" min={0} allowDecimal={false} value={amount} onChange={setAmount} w={180} />}
            <Button leftSection={<IconSend size={16} />} onClick={submit} loading={submitting}>
              Выдать
            </Button>
          </Group>
          {selectedItem && !paid && selectedItem.basic && (
            <Text size="xs" c="dimmed">Базовый набор: сумма будет записана как 0.</Text>
          )}
          <Textarea label="Примечание" minRows={2} value={note} onChange={(event) => setNote(event.currentTarget.value)} />
        </Stack>
      </Paper>

      <Paper withBorder radius="sm">
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : issues.length === 0 ? (
          <Text c="dimmed" ta="center" p="xl">Выдач пока нет.</Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Дата</Table.Th>
                <Table.Th>Ученик</Table.Th>
                <Table.Th>Класс</Table.Th>
                <Table.Th>Товар</Table.Th>
                <Table.Th>Размер</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th>Оплата</Table.Th>
                <Table.Th>Примечание</Table.Th>
                <Table.Th>Действия</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {issues.map((issue) => (
                <Table.Tr key={issue.id}>
                  <Table.Td>{formatDate(issue.issuedAt)}</Table.Td>
                  <Table.Td>{studentName(studentsById.get(issue.studentId))}</Table.Td>
                  <Table.Td>{issue.className || '—'}</Table.Td>
                  <Table.Td>{issue.item?.name ?? '—'}</Table.Td>
                  <Table.Td>{issue.size}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={issue.status === 'reserved' ? 'yellow' : issue.status === 'cancelled' ? 'red' : 'green'} radius="sm">
                      {issue.status === 'reserved' ? 'Бронь' : issue.status === 'cancelled' ? 'Отменена' : 'Выдано'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={issue.paid ? 'orange' : 'green'} radius="sm">
                      {issue.paid ? `${issue.amount ?? 0} сом` : 'Бесплатно'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{issue.note || '—'}</Table.Td>
                  <Table.Td>
                    {issue.status === 'reserved' ? (
                      <Group gap="xs" wrap="nowrap">
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="green"
                          leftSection={<IconCheck size={14} />}
                          loading={submitting}
                          onClick={() => processReservation(issue.id, 'confirm')}
                        >
                          Подтвердить
                        </Button>
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="red"
                          leftSection={<IconX size={14} />}
                          loading={submitting}
                          onClick={() => processReservation(issue.id, 'cancel')}
                        >
                          Отменить
                        </Button>
                      </Group>
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

export default function UniformIssuesPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <UniformIssuesContent />
    </RoleGate>
  );
}
