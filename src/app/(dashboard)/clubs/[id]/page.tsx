'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ActionIcon, Anchor, Badge, Button, Checkbox, Group, Loader, Paper, ScrollArea, SegmentedControl, Select, Stack, Switch, Table, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { DateInput, DatePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCalendar, IconTrash, IconUsers } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['club_coach', 'super_admin', 'zavuch'] as const;
const STATUSES = [
  { value: 'active', label: 'Активен' },
  { value: 'archived', label: 'Архив' },
];
const STATUS_COLOR: Record<string, string> = { active: 'green', archived: 'gray' };
const WEEKDAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
];

type ClubDetail = {
  id: string;
  name: string;
  subjectId?: string | null;
  status?: string | null;
  sessions: { id: string; date: string }[];
  participants: Participant[];
};
type Participant = {
  id: string;
  studentId: string;
  addedAt: string;
  distinguished: boolean;
  student: { id: string; fio: string; className: string } | null;
};
type Student = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  class?: { grade: number; letter: string } | null;
};

function isoDay(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function studentLabel(student: Student) {
  const fio = [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
  const className = student.class ? `${student.class.grade}${student.class.letter}` : '';
  return [fio, className].filter(Boolean).join(' · ');
}

function statusLabel(value?: string | null) {
  return STATUSES.find((status) => status.value === value)?.label ?? value ?? 'Активен';
}

function daysByWeekdays(start: Date | null, end: Date | null, weekdays: number[]) {
  if (!start || !end || start > end || weekdays.length === 0) return [];
  const selected = new Set(weekdays);
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  const days: string[] = [];
  while (cursor <= last) {
    if (selected.has(cursor.getDay())) days.push(isoDay(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function DetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [studentSearch, setStudentSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(studentSearch, 250);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [mode, setMode] = useState('weekdays');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [manualDays, setManualDays] = useState<Date[]>([]);

  const clubQuery = useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/clubs/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить кружок');
      return json.data;
    },
  });

  const studentsQuery = useQuery<Student[]>({
    queryKey: ['students-search', debouncedSearch],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (debouncedSearch.trim()) searchParams.set('search', debouncedSearch.trim());
      const res = await fetch(`/api/v1/students?${searchParams.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось найти учеников');
      return json.data;
    },
    enabled: debouncedSearch.trim().length >= 2,
  });

  const generatedDays = useMemo(() => {
    if (mode === 'manual') return [...new Set(manualDays.map(isoDay))].sort();
    return daysByWeekdays(startDate, endDate, weekdays);
  }, [endDate, manualDays, mode, startDate, weekdays]);

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/v1/clubs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось обновить статус');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', id] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось обновить статус' }),
  });

  const addDays = useMutation({
    mutationFn: async () => {
      if (generatedDays.length === 0) throw new Error('Выберите даты занятий');
      const res = await fetch(`/api/v1/clubs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: generatedDays }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось добавить даты');
      return json.data;
    },
    onSuccess: () => {
      notifications.show({ color: 'green', title: 'Готово', message: 'Даты занятий добавлены' });
      setManualDays([]);
      queryClient.invalidateQueries({ queryKey: ['club', id] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['club-attendance', id] });
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось добавить даты' }),
  });

  const addParticipant = useMutation({
    mutationFn: async (nextStudentId: string) => {
      const res = await fetch(`/api/v1/clubs/${id}/participants`, {
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
      queryClient.invalidateQueries({ queryKey: ['club', id] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['club-attendance', id] });
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось добавить участника' }),
  });

  const removeParticipant = useMutation({
    mutationFn: async (nextStudentId: string) => {
      const res = await fetch(`/api/v1/clubs/${id}/participants?studentId=${encodeURIComponent(nextStudentId)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось удалить участника');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', id] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['club-attendance', id] });
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось удалить участника' }),
  });

  const toggleDistinguished = useMutation({
    mutationFn: async ({ studentId: nextStudentId, distinguished }: { studentId: string; distinguished: boolean }) => {
      const res = await fetch(`/api/v1/clubs/${id}/participants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: nextStudentId, distinguished }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось обновить отметку');
      return json.data;
    },
    onMutate: async ({ studentId: nextStudentId, distinguished }) => {
      await queryClient.cancelQueries({ queryKey: ['club', id] });
      const previous = queryClient.getQueryData<ClubDetail>(['club', id]);
      queryClient.setQueryData<ClubDetail>(['club', id], (current) => {
        if (!current) return current;
        return {
          ...current,
          participants: current.participants.map((participant) => (
            participant.studentId === nextStudentId ? { ...participant, distinguished } : participant
          )),
        };
      });
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['club', id], context.previous);
      notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось обновить отметку' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['club', id] });
    },
  });

  if (clubQuery.isLoading) return <Group justify="center" py="xl"><Loader /></Group>;
  if (clubQuery.isError || !clubQuery.data) return <Text c="red">Не удалось загрузить кружок</Text>;

  const club = clubQuery.data;
  const participantIds = new Set(club.participants.map((participant) => participant.studentId));
  const studentOptions = (studentsQuery.data ?? [])
    .filter((student) => !participantIds.has(student.id))
    .map((student) => ({ value: student.id, label: studentLabel(student) }));

  return (
    <Stack gap="md">
      <Paper withBorder radius="sm" p="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <ThemeIcon size={40} radius="sm" color="grape" variant="light"><IconCalendar size={22} /></ThemeIcon>
            <div>
              <Title order={2}>{club.name}</Title>
              <Group gap="xs" mt={4}>
                <Badge variant="light" color={STATUS_COLOR[club.status ?? 'active'] ?? 'gray'} radius="sm">{statusLabel(club.status)}</Badge>
                <Text size="sm" c="dimmed">{club.sessions.length} занятий · {club.participants.length} участников</Text>
              </Group>
            </div>
          </Group>
          <Group align="flex-end">
            <Button component={Link} href={`/clubs/${id}/attendance`} variant="light">Журнал посещаемости</Button>
            <Select
              label="Статус"
              data={STATUSES}
              value={club.status ?? 'active'}
              onChange={(value) => value && value !== club.status && updateStatus.mutate(value)}
              disabled={updateStatus.isPending}
              w={150}
            />
          </Group>
        </Group>
      </Paper>

      <Paper withBorder radius="sm" p="md">
        <Group justify="space-between" mb="sm">
          <Group gap="xs"><IconCalendar size={18} /><Text fw={700}>Даты занятий</Text></Group>
          <Badge variant="light" radius="sm">{club.sessions.length}</Badge>
        </Group>
        <Group gap="xs" mb="md">
          {club.sessions.map((session) => (
            <Badge key={session.id} variant="light" color="gray" radius="sm">{fmtDate(session.date)}</Badge>
          ))}
          {club.sessions.length === 0 && <Text size="sm" c="dimmed">Даты ещё не добавлены</Text>}
        </Group>
        <Stack gap="sm">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            data={[
              { value: 'weekdays', label: 'По дням недели' },
              { value: 'manual', label: 'Вручную' },
            ]}
          />
          {mode === 'weekdays' ? (
            <>
              <Group grow align="flex-start">
                <DateInput label="Дата начала" value={startDate} onChange={setStartDate} clearable />
                <DateInput label="Дата окончания" value={endDate} onChange={setEndDate} clearable />
              </Group>
              <Checkbox.Group value={weekdays.map(String)} onChange={(values) => setWeekdays(values.map(Number))}>
                <Group gap="sm">{WEEKDAYS.map((day) => <Checkbox key={day.value} value={String(day.value)} label={day.label} />)}</Group>
              </Checkbox.Group>
            </>
          ) : (
            <DatePicker type="multiple" value={manualDays} onChange={setManualDays} />
          )}
          <Group justify="space-between">
            <Badge variant="light" color={generatedDays.length ? 'blue' : 'gray'} radius="sm">Выбрано {generatedDays.length}</Badge>
            <Button loading={addDays.isPending} onClick={() => addDays.mutate()}>Добавить даты</Button>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder radius="sm" p="md">
        <Group justify="space-between" mb="sm" align="flex-end">
          <Group gap="xs"><IconUsers size={18} /><Text fw={700}>Участники</Text><Badge variant="light" radius="sm">{club.participants.length}</Badge></Group>
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
                <Table.Th>Отличился</Table.Th>
                <Table.Th w={60}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {club.participants.map((participant) => (
                <Table.Tr key={participant.id}>
                  <Table.Td><Anchor component={Link} href={`/students/${participant.studentId}`} fw={600}>{participant.student?.fio ?? participant.studentId}</Anchor></Table.Td>
                  <Table.Td>{participant.student?.className || '—'}</Table.Td>
                  <Table.Td>{fmtDate(participant.addedAt)}</Table.Td>
                  <Table.Td>
                    <Switch
                      checked={participant.distinguished}
                      onChange={(event) => toggleDistinguished.mutate({ studentId: participant.studentId, distinguished: event.currentTarget.checked })}
                      disabled={toggleDistinguished.isPending}
                      label={participant.distinguished ? 'Да' : 'Нет'}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Удалить">
                      <ActionIcon color="red" variant="subtle" onClick={() => removeParticipant.mutate(participant.studentId)} loading={removeParticipant.isPending}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
              {club.participants.length === 0 && (
                <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="lg">Участники ещё не добавлены</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

export default function ClubDetailPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <DetailContent />
    </RoleGate>
  );
}
