'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Checkbox, Group, Loader, Modal, Paper, ScrollArea, SegmentedControl, Select, Stack, Table, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { DateInput, DatePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTargetArrow } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;
const STATUSES = [
  { value: 'planned', label: 'Запланирован' },
  { value: 'ongoing', label: 'Идёт' },
  { value: 'finished', label: 'Завершён' },
];
const STATUS_COLOR: Record<string, string> = { planned: 'yellow', ongoing: 'blue', finished: 'gray' };
const WEEKDAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
];

type IntensiveRow = {
  id: string;
  name: string;
  subjectId?: string | null;
  olympiad?: { id: string; name: string } | null;
  startDate: string;
  endDate: string;
  status: string;
  _count: { days: number; participants: number };
};

type Option = { value: string; label: string };

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

function statusLabel(value: string) {
  return STATUSES.find((status) => status.value === value)?.label ?? value;
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

function CreateIntensiveModal({ opened, onClose, subjects, olympiads }: { opened: boolean; onClose: () => void; subjects: Option[]; olympiads: Option[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [olympiadId, setOlympiadId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [status, setStatus] = useState<string | null>('planned');
  const [mode, setMode] = useState('weekdays');
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [manualDays, setManualDays] = useState<Date[]>([]);

  const generatedDays = useMemo(() => {
    if (mode === 'manual') {
      return [...new Set(manualDays.filter((day) => (!startDate || day >= startDate) && (!endDate || day <= endDate)).map(isoDay))].sort();
    }
    return daysByWeekdays(startDate, endDate, weekdays);
  }, [endDate, manualDays, mode, startDate, weekdays]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Укажите название');
      if (!startDate || !endDate) throw new Error('Укажите период');
      if (startDate > endDate) throw new Error('Дата начала не может быть позже даты окончания');
      if (generatedDays.length === 0) throw new Error('Выберите хотя бы один день');

      const res = await fetch('/api/v1/olympiad-center/intensives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          subjectId,
          olympiadId,
          startDate: isoDay(startDate),
          endDate: isoDay(endDate),
          status,
          days: generatedDays,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось создать интенсив');
      return json.data as { id: string };
    },
    onSuccess: (created) => {
      notifications.show({ color: 'green', title: 'Готово', message: 'Интенсив создан' });
      queryClient.invalidateQueries({ queryKey: ['olympiad-intensives'] });
      onClose();
      router.push(`/olympiad-center/intensives/${created.id}`);
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось создать интенсив' }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Новый интенсив" size="lg">
      <Stack gap="sm">
        <TextInput label="Название" value={name} onChange={(event) => setName(event.currentTarget.value)} required />
        <Select label="Предмет" data={subjects} value={subjectId} onChange={setSubjectId} searchable clearable />
        <Select label="Олимпиада" data={olympiads} value={olympiadId} onChange={setOlympiadId} searchable clearable placeholder="Общая подготовка" />
        <Group grow align="flex-start">
          <DateInput label="Дата начала" value={startDate} onChange={setStartDate} clearable required />
          <DateInput label="Дата окончания" value={endDate} onChange={setEndDate} clearable required />
          <Select label="Статус" data={STATUSES} value={status} onChange={setStatus} />
        </Group>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          data={[
            { value: 'weekdays', label: 'Дни недели' },
            { value: 'manual', label: 'Вручную' },
          ]}
        />
        {mode === 'weekdays' ? (
          <Checkbox.Group value={weekdays.map(String)} onChange={(values) => setWeekdays(values.map(Number))}>
            <Group gap="sm">{WEEKDAYS.map((day) => <Checkbox key={day.value} value={String(day.value)} label={day.label} />)}</Group>
          </Checkbox.Group>
        ) : (
          <DatePicker type="multiple" value={manualDays} onChange={setManualDays} minDate={startDate ?? undefined} maxDate={endDate ?? undefined} />
        )}
        <Badge variant="light" color={generatedDays.length ? 'blue' : 'gray'} radius="sm" w="fit-content">
          Сгенерировано {generatedDays.length} дней
        </Badge>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>Создать</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function IntensivesPageContent() {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const intensivesQuery = useQuery<IntensiveRow[]>({
    queryKey: ['olympiad-intensives'],
    queryFn: async () => {
      const res = await fetch('/api/v1/olympiad-center/intensives');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить интенсивы');
      return json.data;
    },
  });
  const subjectsQuery = useQuery<Option[]>({
    queryKey: ['olympiad-subject-options'],
    queryFn: async () => {
      const res = await fetch('/api/v1/grading/subjects');
      const json = await res.json();
      return json.success ? json.data.map((row: { id: string; name: string }) => ({ value: row.id, label: row.name })) : [];
    },
  });
  const olympiadsQuery = useQuery<Option[]>({
    queryKey: ['olympiad-options'],
    queryFn: async () => {
      const res = await fetch('/api/v1/olympiad-center/olympiads');
      const json = await res.json();
      return json.success ? json.data.map((row: { id: string; name: string }) => ({ value: row.id, label: row.name })) : [];
    },
  });
  const subjectMap = new Map((subjectsQuery.data ?? []).map((subject) => [subject.value, subject.label]));

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <ThemeIcon size={40} radius="sm" color="orange" variant="light"><IconTargetArrow size={22} /></ThemeIcon>
          <div>
            <Title order={2}>Интенсивы</Title>
            <Text size="sm" c="dimmed">Олимпиадная подготовка и составы участников</Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>Интенсив</Button>
      </Group>

      <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
        {intensivesQuery.isLoading ? (
          <Group justify="center" py="xl"><Loader /></Group>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="sm" miw={900}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Название</Table.Th>
                  <Table.Th>Предмет</Table.Th>
                  <Table.Th>Олимпиада</Table.Th>
                  <Table.Th>Период</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Дни</Table.Th>
                  <Table.Th>Участники</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(intensivesQuery.data ?? []).map((intensive) => (
                  <Table.Tr key={intensive.id} onClick={() => router.push(`/olympiad-center/intensives/${intensive.id}`)} style={{ cursor: 'pointer' }}>
                    <Table.Td><Text fw={600}>{intensive.name}</Text></Table.Td>
                    <Table.Td>{intensive.subjectId ? subjectMap.get(intensive.subjectId) ?? '—' : '—'}</Table.Td>
                    <Table.Td>{intensive.olympiad?.name ?? 'Общая подготовка'}</Table.Td>
                    <Table.Td>{fmtDate(intensive.startDate)} - {fmtDate(intensive.endDate)}</Table.Td>
                    <Table.Td><Badge variant="light" color={STATUS_COLOR[intensive.status] ?? 'gray'} radius="sm">{statusLabel(intensive.status)}</Badge></Table.Td>
                    <Table.Td>{intensive._count.days}</Table.Td>
                    <Table.Td>{intensive._count.participants}</Table.Td>
                  </Table.Tr>
                ))}
                {(intensivesQuery.data ?? []).length === 0 && (
                  <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center" py="lg">Интенсивы ещё не созданы</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      <CreateIntensiveModal opened={opened} onClose={() => setOpened(false)} subjects={subjectsQuery.data ?? []} olympiads={olympiadsQuery.data ?? []} />
    </Stack>
  );
}

export default function OlympiadCenterIntensivesPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <IntensivesPageContent />
    </RoleGate>
  );
}
