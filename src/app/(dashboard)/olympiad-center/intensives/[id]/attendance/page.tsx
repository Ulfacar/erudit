'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Button, Group, Loader, Paper, ScrollArea, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconCalendarCheck, IconCircleCheck, IconFileSpreadsheet } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EXCEL_EXPORT_LABEL, exportOlympiadAttendanceExcel } from '@/modules/olympiad/excel';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;
const CYCLE = ['present', 'absent', 'excused'] as const;

type AttendanceStatus = (typeof CYCLE)[number];
type Day = { id: string; date: string };
type Participant = { studentId: string; fio: string; className: string };
type Mark = { studentId: string; date: string; status: AttendanceStatus };
type AttendanceGrid = { days: Day[]; participants: Participant[]; marks: Mark[] };

const STATUS_META: Record<AttendanceStatus, { label: string; short: string; color: string }> = {
  present: { label: 'Присутствует', short: 'П', color: 'green' },
  absent: { label: 'Отсутствует', short: 'Н', color: 'red' },
  excused: { label: 'Уважительная', short: 'У', color: 'yellow' },
};

function isoDay(value: string) {
  return value.slice(0, 10);
}

function fmtDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(new Date(value));
}

function nextStatus(status?: AttendanceStatus) {
  if (!status) return 'present';
  return CYCLE[(CYCLE.indexOf(status) + 1) % CYCLE.length];
}

function markKey(studentId: string, date: string) {
  return `${studentId}:${date}`;
}

function AttendanceContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();

  const attendanceQuery = useQuery<AttendanceGrid>({
    queryKey: ['olympiad-intensive-attendance', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/olympiad-center/intensives/${id}/attendance`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить журнал посещаемости');
      return json.data;
    },
  });

  const saveMark = useMutation({
    mutationFn: async (mark: Mark) => {
      const res = await fetch(`/api/v1/olympiad-center/intensives/${id}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mark),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось сохранить отметку');
      return json.data as AttendanceGrid;
    },
    onMutate: async (mark) => {
      await queryClient.cancelQueries({ queryKey: ['olympiad-intensive-attendance', id] });
      const previous = queryClient.getQueryData<AttendanceGrid>(['olympiad-intensive-attendance', id]);
      queryClient.setQueryData<AttendanceGrid>(['olympiad-intensive-attendance', id], (current) => {
        if (!current) return current;
        const marks = current.marks.filter((item) => markKey(item.studentId, item.date) !== markKey(mark.studentId, mark.date));
        return { ...current, marks: [...marks, mark] };
      });
      return { previous };
    },
    onError: (error, _mark, context) => {
      if (context?.previous) queryClient.setQueryData(['olympiad-intensive-attendance', id], context.previous);
      notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось сохранить отметку' });
    },
    onSuccess: (data) => queryClient.setQueryData(['olympiad-intensive-attendance', id], data),
  });

  const markAllPresent = useMutation({
    mutationFn: async (date: string) => {
      const res = await fetch(`/api/v1/olympiad-center/intensives/${id}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, status: 'present', all: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось отметить день');
      return json.data as AttendanceGrid;
    },
    onSuccess: (data) => queryClient.setQueryData(['olympiad-intensive-attendance', id], data),
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось отметить день' }),
  });

  if (attendanceQuery.isLoading) return <Group justify="center" py="xl"><Loader /></Group>;
  if (attendanceQuery.isError || !attendanceQuery.data) return <Text c="red">Не удалось загрузить журнал посещаемости</Text>;

  const grid = attendanceQuery.data;
  const days = grid.days.map((day) => ({ ...day, key: isoDay(day.date) }));
  const marks = new Map(grid.marks.map((mark) => [markKey(mark.studentId, mark.date), mark.status]));
  const empty = grid.days.length === 0 || grid.participants.length === 0;
  const handleExport = () => exportOlympiadAttendanceExcel(grid, id);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <ThemeIcon size={40} radius="sm" color="teal" variant="light"><IconCalendarCheck size={22} /></ThemeIcon>
          <div>
            <Title order={2}>Журнал посещаемости</Title>
            <Text size="sm" c="dimmed">Отметки по дням интенсива</Text>
          </div>
        </Group>
        {!empty && (
          <Button variant="light" leftSection={<IconFileSpreadsheet size={16} />} onClick={handleExport}>
            {EXCEL_EXPORT_LABEL}
          </Button>
        )}
        <Button component={Link} href={`/olympiad-center/intensives/${id}`} variant="subtle" leftSection={<IconArrowLeft size={16} />}>
          Назад к интенсиву
        </Button>
      </Group>

      <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
        {empty ? (
          <Text c="dimmed" ta="center" py="xl">Добавьте участников и дни интенсива</Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="sm" miw={920}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th miw={260}>Участник</Table.Th>
                  {days.map((day) => (
                    <Table.Th key={day.id} ta="center" miw={96}>
                      <Stack gap={4} align="center">
                        <Text size="xs" fw={700}>{fmtDate(day.date)}</Text>
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="green"
                          leftSection={<IconCircleCheck size={12} />}
                          loading={markAllPresent.isPending}
                          onClick={() => markAllPresent.mutate(day.key)}
                        >
                          Все пришли
                        </Button>
                      </Stack>
                    </Table.Th>
                  ))}
                  <Table.Th ta="center" miw={90}>Итого</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {grid.participants.map((participant) => {
                  const presentCount = days.filter((day) => marks.get(markKey(participant.studentId, day.key)) === 'present').length;
                  return (
                    <Table.Tr key={participant.studentId}>
                      <Table.Td>
                        <Text fw={600}>{participant.fio}</Text>
                        <Text size="xs" c="dimmed">{participant.className || 'Без класса'}</Text>
                      </Table.Td>
                      {days.map((day) => {
                        const status = marks.get(markKey(participant.studentId, day.key));
                        const meta = status ? STATUS_META[status] : null;
                        return (
                          <Table.Td key={day.id} ta="center">
                            <Button
                              size="compact-sm"
                              variant={meta ? 'light' : 'outline'}
                              color={meta?.color ?? 'gray'}
                              onClick={() => saveMark.mutate({ studentId: participant.studentId, date: day.key, status: nextStatus(status) })}
                              title={meta?.label ?? 'Не отмечено'}
                              miw={42}
                            >
                              {meta?.short ?? '-'}
                            </Button>
                          </Table.Td>
                        );
                      })}
                      <Table.Td ta="center">
                        <Badge variant="light" color="teal" radius="sm">{presentCount} / {days.length}</Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>
    </Stack>
  );
}

export default function OlympiadCenterIntensiveAttendancePage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <AttendanceContent />
    </RoleGate>
  );
}
