'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ActionIcon, Anchor, Badge, Button, Group, Loader, Paper, ScrollArea, Select, Stack, Table, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCalendar, IconTrash, IconUsers } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;
const STATUSES = [
  { value: 'planned', label: 'Запланирован' },
  { value: 'ongoing', label: 'Идёт' },
  { value: 'finished', label: 'Завершён' },
];
const STATUS_COLOR: Record<string, string> = { planned: 'yellow', ongoing: 'blue', finished: 'gray' };

type IntensiveDetail = {
  id: string;
  name: string;
  subjectId?: string | null;
  olympiad?: { id: string; name: string } | null;
  startDate: string;
  endDate: string;
  status: string;
  days: { id: string; date: string }[];
  participants: Participant[];
};

type Participant = {
  id: string;
  studentId: string;
  addedAt: string;
  student: { id: string; fio: string; className: string } | null;
};

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  class?: { grade: number; letter: string } | null;
};

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function studentLabel(student: Student) {
  const fio = [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
  const className = student.class ? `${student.class.grade}${student.class.letter}` : '';
  return [fio, className].filter(Boolean).join(' · ');
}

function statusLabel(value: string) {
  return STATUSES.find((status) => status.value === value)?.label ?? value;
}

function DetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [studentSearch, setStudentSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(studentSearch, 250);
  const [studentId, setStudentId] = useState<string | null>(null);

  const intensiveQuery = useQuery<IntensiveDetail>({
    queryKey: ['olympiad-intensive', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/olympiad-center/intensives/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить интенсив');
      return json.data;
    },
  });

  const studentsQuery = useQuery<Student[]>({
    queryKey: ['students-search', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      const res = await fetch(`/api/v1/students?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось найти учеников');
      return json.data;
    },
    enabled: debouncedSearch.trim().length >= 2,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/v1/olympiad-center/intensives/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось обновить статус');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['olympiad-intensive', id] });
      queryClient.invalidateQueries({ queryKey: ['olympiad-intensives'] });
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось обновить статус' }),
  });

  const addParticipant = useMutation({
    mutationFn: async (nextStudentId: string) => {
      const res = await fetch(`/api/v1/olympiad-center/intensives/${id}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: nextStudentId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось добавить участника');
      return json.data;
    },
    onSuccess: () => {
      notifications.show({ color: 'green', title: 'Готово', message: 'Участник добавлен' });
      setStudentId(null);
      setStudentSearch('');
      queryClient.invalidateQueries({ queryKey: ['olympiad-intensive', id] });
      queryClient.invalidateQueries({ queryKey: ['olympiad-intensives'] });
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось добавить участника' }),
  });

  const removeParticipant = useMutation({
    mutationFn: async (nextStudentId: string) => {
      const res = await fetch(`/api/v1/olympiad-center/intensives/${id}/participants?studentId=${encodeURIComponent(nextStudentId)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось удалить участника');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['olympiad-intensive', id] });
      queryClient.invalidateQueries({ queryKey: ['olympiad-intensives'] });
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось удалить участника' }),
  });

  if (intensiveQuery.isLoading) return <Group justify="center" py="xl"><Loader /></Group>;
  if (intensiveQuery.isError || !intensiveQuery.data) return <Text c="red">Не удалось загрузить интенсив</Text>;

  const intensive = intensiveQuery.data;
  const participantIds = new Set(intensive.participants.map((participant) => participant.studentId));
  const studentOptions = (studentsQuery.data ?? [])
    .filter((student) => !participantIds.has(student.id))
    .map((student) => ({ value: student.id, label: studentLabel(student) }));

  return (
    <Stack gap="md">
      <Paper withBorder radius="sm" p="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <ThemeIcon size={40} radius="sm" color="orange" variant="light"><IconCalendar size={22} /></ThemeIcon>
            <div>
              <Title order={2}>{intensive.name}</Title>
              <Group gap="xs" mt={4}>
                {intensive.olympiad ? (
                  <Anchor component={Link} href={`/olympiad-center/olympiads`} size="sm">{intensive.olympiad.name}</Anchor>
                ) : (
                  <Text size="sm" c="dimmed">Общая подготовка</Text>
                )}
                <Text size="sm" c="dimmed">· {fmtDate(intensive.startDate)} - {fmtDate(intensive.endDate)}</Text>
                <Badge variant="light" color={STATUS_COLOR[intensive.status] ?? 'gray'} radius="sm">{statusLabel(intensive.status)}</Badge>
              </Group>
            </div>
          </Group>
          <Button component={Link} href={`/olympiad-center/intensives/${id}/attendance`} variant="light">Журнал посещаемости</Button>
          <Button component={Link} href={`/olympiad-center/intensives/${id}/metrics`} variant="light">Метрики и KPI</Button>
          <Select
            label="Статус"
            data={STATUSES}
            value={intensive.status}
            onChange={(value) => value && value !== intensive.status && updateStatus.mutate(value)}
            disabled={updateStatus.isPending}
            w={190}
          />
        </Group>
      </Paper>

      <Paper withBorder radius="sm" p="md">
        <Group justify="space-between" mb="sm">
          <Group gap="xs"><IconCalendar size={18} /><Text fw={700}>Дни</Text></Group>
          <Badge variant="light" radius="sm">{intensive.days.length}</Badge>
        </Group>
        <Group gap="xs">
          {intensive.days.map((day) => (
            <Badge key={day.id} variant="light" color="gray" radius="sm">{fmtDate(day.date)}</Badge>
          ))}
        </Group>
      </Paper>

      <Paper withBorder radius="sm" p="md">
        <Group justify="space-between" mb="sm" align="flex-end">
          <Group gap="xs"><IconUsers size={18} /><Text fw={700}>Участники</Text><Badge variant="light" radius="sm">{intensive.participants.length}</Badge></Group>
          <Group gap="xs" align="flex-end">
            <Select
              label="Поиск ученика"
              placeholder="Введите ФИО"
              data={studentOptions}
              value={studentId}
              onChange={setStudentId}
              searchValue={studentSearch}
              onSearchChange={setStudentSearch}
              searchable
              clearable
              nothingFoundMessage={debouncedSearch.trim().length < 2 ? 'Введите минимум 2 символа' : 'Ученики не найдены'}
              w={340}
            />
            <Button loading={addParticipant.isPending} disabled={!studentId} onClick={() => studentId && addParticipant.mutate(studentId)}>Добавить</Button>
          </Group>
        </Group>

        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={620}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ФИО</Table.Th>
                <Table.Th>Класс</Table.Th>
                <Table.Th>Добавлен</Table.Th>
                <Table.Th w={60}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {intensive.participants.map((participant) => (
                <Table.Tr key={participant.id}>
                  <Table.Td><Text fw={600}>{participant.student?.fio ?? participant.studentId}</Text></Table.Td>
                  <Table.Td>{participant.student?.className || '—'}</Table.Td>
                  <Table.Td>{fmtDate(participant.addedAt)}</Table.Td>
                  <Table.Td>
                    <Tooltip label="Удалить">
                      <ActionIcon color="red" variant="subtle" onClick={() => removeParticipant.mutate(participant.studentId)} loading={removeParticipant.isPending}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
              {intensive.participants.length === 0 && (
                <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="lg">Участники ещё не добавлены</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

export default function OlympiadCenterIntensiveDetailPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <DetailContent />
    </RoleGate>
  );
}
