'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconClockHour4 } from '@tabler/icons-react';
import type { Role } from '@prisma/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useRole } from '@/shared/hooks/useRole';
import { roleMatches } from '@/shared/lib/role-access';

const PAGE_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'];
const CREATE_ROLES: Role[] = ['super_admin', 'zavuch', 'teacher', 'curator'];
const SELF_ROLES: Role[] = ['teacher', 'curator'];
const ADMIN_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch'];
const TIME_OFF_LIMIT = 10;

interface TeacherShort {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  position?: string | null;
}

interface TeacherHours {
  id: string;
  teacherId: string;
  teacher: TeacherShort | null;
  date: string;
  hours: number;
  note: string | null;
  createdAt: string;
}

interface TimeOffRequest {
  id: string;
  teacherId: string;
  teacher: TeacherShort | null;
  date: string;
  hours: number;
  status: string;
}

interface SummaryRow {
  teacherId: string;
  teacher: TeacherShort | null;
  presenceHours: number;
  overLimit: number;
  net: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { message?: string };
}

function formatTeacherName(teacher: TeacherShort | null | undefined) {
  if (!teacher) return '—';
  return [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function isCurrentMonth(value: string, month: number, year: number) {
  const date = new Date(value);
  return date.getFullYear() === year && date.getMonth() === month;
}

async function readJson<T>(res: Response): Promise<ApiResponse<T>> {
  return (await res.json()) as ApiResponse<T>;
}

export default function TeacherHoursPage() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const canCreate = roleMatches(CREATE_ROLES, role);
  const isSelfView = roleMatches(SELF_ROLES, role);
  const isAdmin = roleMatches(ADMIN_ROLES, role);

  const [date, setDate] = useState('');
  const [hours, setHours] = useState<number | string>(1);
  const [note, setNote] = useState('');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: items = [], isLoading } = useQuery<TeacherHours[]>({
    queryKey: ['teacher-hours'],
    queryFn: async () => {
      const res = await fetch('/api/v1/teacher-hours');
      const json = await readJson<TeacherHours[]>(res);
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка загрузки');
      return json.data;
    },
  });

  const { data: teachers = [] } = useQuery<TeacherShort[]>({
    queryKey: ['teachers-for-teacher-hours'],
    enabled: canCreate && !isSelfView,
    queryFn: async () => {
      const res = await fetch('/api/v1/teachers');
      const json = await readJson<TeacherShort[]>(res);
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка загрузки педагогов');
      return json.data;
    },
  });

  const { data: timeOffRequests = [] } = useQuery<TimeOffRequest[]>({
    queryKey: ['time-off-for-teacher-hours'],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetch('/api/v1/time-off');
      const json = await readJson<TimeOffRequest[]>(res);
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка загрузки отгулов');
      return json.data;
    },
  });

  const teacherOptions = useMemo(
    () => teachers.map((teacher) => ({ value: teacher.id, label: formatTeacherName(teacher) })),
    [teachers],
  );

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const rows = new Map<string, SummaryRow>();

    items.forEach((item) => {
      if (!isCurrentMonth(item.date, month, year)) return;
      const row = rows.get(item.teacherId) ?? {
        teacherId: item.teacherId,
        teacher: item.teacher,
        presenceHours: 0,
        overLimit: 0,
        net: 0,
      };
      row.presenceHours += item.hours;
      row.teacher = row.teacher ?? item.teacher;
      rows.set(item.teacherId, row);
    });

    const timeOffByTeacher = new Map<string, number>();
    timeOffRequests.forEach((request) => {
      if (request.status !== 'approved' || !isCurrentMonth(request.date, month, year)) return;
      timeOffByTeacher.set(
        request.teacherId,
        (timeOffByTeacher.get(request.teacherId) ?? 0) + request.hours,
      );
    });

    return Array.from(rows.values())
      .map((row) => {
        const overLimit = Math.max(0, (timeOffByTeacher.get(row.teacherId) ?? 0) - TIME_OFF_LIMIT);
        return {
          ...row,
          overLimit,
          net: row.presenceHours - overLimit,
        };
      })
      .sort((a, b) => formatTeacherName(a.teacher).localeCompare(formatTeacherName(b.teacher), 'ru'));
  }, [items, timeOffRequests]);

  async function createItem() {
    setCreating(true);
    try {
      const payload: { date: string; hours: number; note?: string; teacherId?: string } = {
        date,
        hours: Number(hours),
      };
      if (note.trim()) payload.note = note.trim();
      if (!isSelfView && teacherId) payload.teacherId = teacherId;

      const res = await fetch('/api/v1/teacher-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await readJson<TeacherHours>(res);
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось создать запись');

      notifications.show({ color: 'green', title: 'Запись создана', message: 'Часы присутствия сохранены' });
      setDate('');
      setHours(1);
      setNote('');
      setTeacherId(null);
      queryClient.invalidateQueries({ queryKey: ['teacher-hours'] });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось создать запись',
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <RoleGate roles={PAGE_ROLES}>
      <Stack gap="md">
        <Group gap="sm">
          <IconClockHour4 size={24} color="#228be6" />
          <Box>
            <Text fw={700} size="xl">
              Часы присутствия
            </Text>
            <Text size="sm" c="dimmed">
              Учёт часов присутствия педагогов в школе
            </Text>
          </Box>
        </Group>

        {canCreate && (
          <Box p="md" style={{ border: '1px solid #e6e9ee', borderRadius: 6, background: '#fff' }}>
            <Stack gap="sm">
              <Text fw={600}>Новая запись</Text>
              <Group align="flex-end">
                {!isSelfView && (
                  <Select
                    label="Педагог"
                    placeholder="Выберите педагога"
                    data={teacherOptions}
                    value={teacherId}
                    onChange={setTeacherId}
                    searchable
                    required
                    w={260}
                  />
                )}
                <TextInput
                  label="Дата"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.currentTarget.value)}
                  required
                />
                <NumberInput
                  label="Часы"
                  min={1}
                  max={24}
                  step={1}
                  value={hours}
                  onChange={setHours}
                  required
                  w={120}
                />
                <Button
                  loading={creating}
                  onClick={createItem}
                  disabled={!date || Number(hours) <= 0 || Number(hours) > 24 || (!isSelfView && !teacherId)}
                >
                  Сохранить
                </Button>
              </Group>
              <Textarea
                label="Примечание"
                minRows={2}
                value={note}
                onChange={(event) => setNote(event.currentTarget.value)}
              />
            </Stack>
          </Box>
        )}

        {isAdmin && (
          <Box style={{ border: '1px solid #e6e9ee', borderRadius: 6, background: '#fff', overflow: 'hidden' }}>
            <Box p="md" pb={0}>
              <Text fw={600}>Сводка за текущий месяц</Text>
            </Box>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Педагог</Table.Th>
                  <Table.Th>Присутствие (ч)</Table.Th>
                  <Table.Th>Отгулы сверх лимита (ч)</Table.Th>
                  <Table.Th>Итого (ч)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summaryRows.map((row) => (
                  <Table.Tr key={row.teacherId}>
                    <Table.Td>{formatTeacherName(row.teacher)}</Table.Td>
                    <Table.Td>{row.presenceHours}</Table.Td>
                    <Table.Td>{row.overLimit}</Table.Td>
                    <Table.Td>{row.net}</Table.Td>
                  </Table.Tr>
                ))}
                {summaryRows.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text ta="center" c="dimmed" py="lg">
                        Данных за текущий месяц нет
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Box>
        )}

        <Box style={{ border: '1px solid #e6e9ee', borderRadius: 6, background: '#fff', overflow: 'hidden' }}>
          {isLoading ? (
            <Group justify="center" p="xl">
              <Loader />
            </Group>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Дата</Table.Th>
                  <Table.Th>Педагог</Table.Th>
                  <Table.Th>Часы</Table.Th>
                  <Table.Th>Примечание</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{formatDate(item.date)}</Table.Td>
                    <Table.Td>{formatTeacherName(item.teacher)}</Table.Td>
                    <Table.Td>{item.hours}</Table.Td>
                    <Table.Td>{item.note || '—'}</Table.Td>
                  </Table.Tr>
                ))}
                {items.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text ta="center" c="dimmed" py="lg">
                        Записей нет
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </Box>
      </Stack>
    </RoleGate>
  );
}
