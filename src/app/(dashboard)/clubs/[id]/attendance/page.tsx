'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Button, Group, Loader, Paper, ScrollArea, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconCalendarCheck, IconCircleCheck } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['club_coach', 'super_admin', 'zavuch'] as const;
const CYCLE = ['present', 'absent', 'excused'] as const;

type AttendanceStatus = (typeof CYCLE)[number];
type Session = { id: string; date: string };
type Participant = { studentId: string; fio: string; className: string };
type Mark = { studentId: string; date: string; status: AttendanceStatus };
type AttendanceGrid = { sessions: Session[]; participants: Participant[]; marks: Mark[] };

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
    queryKey: ['club-attendance', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/clubs/${id}/attendance`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить журнал посещаемости');
      return json.data;
    },
  });

  const saveMark = useMutation({
    mutationFn: async (mark: Mark) => {
      const res = await fetch(`/api/v1/clubs/${id}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mark),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось сохранить отметку');
      return json.data as AttendanceGrid;
    },
    onMutate: async (mark) => {
      await queryClient.cancelQueries({ queryKey: ['club-attendance', id] });
      const previous = queryClient.getQueryData<AttendanceGrid>(['club-attendance', id]);
      queryClient.setQueryData<AttendanceGrid>(['club-attendance', id], (current) => {
        if (!current) return current;
        const marks = current.marks.filter((item) => markKey(item.studentId, item.date) !== markKey(mark.studentId, mark.date));
        return { ...current, marks: [...marks, mark] };
      });
      return { previous };
    },
    onError: (error, _mark, context) => {
      if (context?.previous) queryClient.setQueryData(['club-attendance', id], context.previous);
      notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось сохранить отметку' });
    },
    onSuccess: (data) => queryClient.setQueryData(['club-attendance', id], data),
  });

  const markAllPresent = useMutation({
    mutationFn: async (date: string) => {
      const res = await fetch(`/api/v1/clubs/${id}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, status: 'present', all: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось отметить день');
      return json.data as AttendanceGrid;
    },
    onSuccess: (data) => queryClient.setQueryData(['club-attendance', id], data),
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось отметить день' }),
  });

  if (attendanceQuery.isLoading) return <Group justify="center" py="xl"><Loader /></Group>;
  if (attendanceQuery.isError || !attendanceQuery.data) return <Text c="red">Не удалось загрузить журнал посещаемости</Text>;

  const grid = attendanceQuery.data;
  const sessions = grid.sessions.map((session) => ({ ...session, key: isoDay(session.date) }));
  const marks = new Map(grid.marks.map((mark) => [markKey(mark.studentId, mark.date), mark.status]));
  const empty = grid.sessions.length === 0 || grid.participants.length === 0;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <ThemeIcon size={40} radius="sm" color="teal" variant="light"><IconCalendarCheck size={22} /></ThemeIcon>
          <div>
            <Title order={2}>Журнал посещаемости</Title>
            <Text size="sm" c="dimmed">Отметки по занятиям кружка</Text>
          </div>
        </Group>
        <Button component={Link} href={`/clubs/${id}`} variant="subtle" leftSection={<IconArrowLeft size={16} />}>
          Назад к кружку
        </Button>
      </Group>

      <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
        {empty ? (
          <Text c="dimmed" ta="center" py="xl">Добавьте участников и даты занятий</Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="sm" miw={920}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th miw={260}>Участник</Table.Th>
                  {sessions.map((session) => (
                    <Table.Th key={session.id} ta="center" miw={96}>
                      <Stack gap={4} align="center">
                        <Text size="xs" fw={700}>{fmtDate(session.date)}</Text>
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="green"
                          leftSection={<IconCircleCheck size={12} />}
                          loading={markAllPresent.isPending}
                          onClick={() => markAllPresent.mutate(session.key)}
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
                  const presentCount = sessions.filter((session) => marks.get(markKey(participant.studentId, session.key)) === 'present').length;
                  return (
                    <Table.Tr key={participant.studentId}>
                      <Table.Td>
                        <Text fw={600}>{participant.fio}</Text>
                        <Text size="xs" c="dimmed">{participant.className || 'Без класса'}</Text>
                      </Table.Td>
                      {sessions.map((session) => {
                        const status = marks.get(markKey(participant.studentId, session.key));
                        const meta = status ? STATUS_META[status] : null;
                        return (
                          <Table.Td key={session.id} ta="center">
                            <Button
                              size="compact-sm"
                              variant={meta ? 'light' : 'outline'}
                              color={meta?.color ?? 'gray'}
                              onClick={() => saveMark.mutate({ studentId: participant.studentId, date: session.key, status: nextStatus(status) })}
                              title={meta?.label ?? 'Не отмечено'}
                              miw={42}
                            >
                              {meta?.short ?? '-'}
                            </Button>
                          </Table.Td>
                        );
                      })}
                      <Table.Td ta="center">
                        <Badge variant="light" color="teal" radius="sm">{presentCount} / {sessions.length}</Badge>
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

export default function ClubAttendancePage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <AttendanceContent />
    </RoleGate>
  );
}
