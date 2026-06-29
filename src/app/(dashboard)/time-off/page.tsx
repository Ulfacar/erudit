'use client';

import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconCalendarOff, IconX } from '@tabler/icons-react';
import type { Role } from '@prisma/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useRole } from '@/shared/hooks/useRole';
import { roleMatches } from '@/shared/lib/role-access';

const PAGE_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'];
const CREATE_ROLES: Role[] = ['teacher', 'curator', 'super_admin', 'zavuch'];
const DECIDE_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch'];
const SELF_ROLES: Role[] = ['teacher', 'curator'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  approved: 'Одобрено',
  rejected: 'Отклонено',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

interface TeacherShort {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  position?: string | null;
}

interface TimeOffRequest {
  id: string;
  teacherId: string;
  teacher: TeacherShort | null;
  date: string;
  hours: number;
  reason: string | null;
  status: string;
  substituteTeacherId: string | null;
  substituteTeacher: TeacherShort | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { message?: string };
}

interface DecisionState {
  request: TimeOffRequest;
  status: 'approved' | 'rejected';
}

function formatTeacherName(teacher: TeacherShort | null | undefined) {
  if (!teacher) return '—';
  return [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function monthApprovedHours(requests: TimeOffRequest[]) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  return requests.reduce((sum, request) => {
    const date = new Date(request.date);
    if (
      request.status === 'approved' &&
      date.getFullYear() === year &&
      date.getMonth() === month
    ) {
      return sum + request.hours;
    }
    return sum;
  }, 0);
}

async function readJson<T>(res: Response): Promise<ApiResponse<T>> {
  return (await res.json()) as ApiResponse<T>;
}

export default function TimeOffPage() {
  const { role } = useRole();
  const queryClient = useQueryClient();
  const canCreate = roleMatches(CREATE_ROLES, role);
  const canDecide = roleMatches(DECIDE_ROLES, role);
  const isSelfView = roleMatches(SELF_ROLES, role);

  const [date, setDate] = useState('');
  const [hours, setHours] = useState<number | string>(1);
  const [reason, setReason] = useState('');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [decision, setDecision] = useState<DecisionState | null>(null);
  const [substituteTeacherId, setSubstituteTeacherId] = useState<string | null>(null);
  const [savingDecision, setSavingDecision] = useState(false);

  const { data: requests = [], isLoading } = useQuery<TimeOffRequest[]>({
    queryKey: ['time-off'],
    queryFn: async () => {
      const res = await fetch('/api/v1/time-off');
      const json = await readJson<TimeOffRequest[]>(res);
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка загрузки');
      return json.data;
    },
  });

  const { data: teachers = [] } = useQuery<TeacherShort[]>({
    queryKey: ['teachers-for-time-off'],
    enabled: canDecide || (canCreate && !isSelfView),
    queryFn: async () => {
      const res = await fetch('/api/v1/teachers');
      const json = await readJson<TeacherShort[]>(res);
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка загрузки педагогов');
      return json.data;
    },
  });

  const teacherOptions = useMemo(
    () => teachers.map((teacher) => ({ value: teacher.id, label: formatTeacherName(teacher) })),
    [teachers],
  );

  const usedHours = monthApprovedHours(requests);
  const overLimit = Math.max(0, usedHours - 10);

  async function createRequest() {
    setCreating(true);
    try {
      const payload: { date: string; hours: number; reason?: string; teacherId?: string } = {
        date,
        hours: Number(hours),
      };
      if (reason.trim()) payload.reason = reason.trim();
      if (!isSelfView && teacherId) payload.teacherId = teacherId;

      const res = await fetch('/api/v1/time-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await readJson<TimeOffRequest>(res);
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось создать заявку');

      notifications.show({ color: 'green', title: 'Заявка создана', message: 'Статус: ожидает' });
      setDate('');
      setHours(1);
      setReason('');
      setTeacherId(null);
      queryClient.invalidateQueries({ queryKey: ['time-off'] });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось создать заявку',
      });
    } finally {
      setCreating(false);
    }
  }

  function openDecision(request: TimeOffRequest, status: DecisionState['status']) {
    setDecision({ request, status });
    setSubstituteTeacherId(request.substituteTeacherId);
  }

  async function submitDecision() {
    if (!decision) return;
    setSavingDecision(true);
    try {
      const res = await fetch(`/api/v1/time-off/${decision.request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: decision.status,
          substituteTeacherId,
        }),
      });
      const json = await readJson<TimeOffRequest>(res);
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось сохранить решение');

      notifications.show({
        color: 'green',
        title: 'Решение сохранено',
        message: STATUS_LABELS[decision.status],
      });
      setDecision(null);
      setSubstituteTeacherId(null);
      queryClient.invalidateQueries({ queryKey: ['time-off'] });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось сохранить решение',
      });
    } finally {
      setSavingDecision(false);
    }
  }

  return (
    <RoleGate roles={PAGE_ROLES}>
      <Stack gap="md">
        <Group gap="sm">
          <IconCalendarOff size={24} color="#228be6" />
          <Box>
            <Text fw={700} size="xl">
              Отгулы
            </Text>
            <Text size="sm" c="dimmed">
              Заявки педагогов на отсутствие и замещение
            </Text>
          </Box>
        </Group>

        {isSelfView && (
          <Alert color={overLimit > 0 ? 'red' : 'blue'} variant="light">
            Использовано в текущем месяце: {usedHours}/10 ч.
            {overLimit > 0 ? ` Превышение: ${overLimit} ч.` : ''}
          </Alert>
        )}

        {canCreate && (
          <Box p="md" style={{ border: '1px solid #e6e9ee', borderRadius: 6, background: '#fff' }}>
            <Stack gap="sm">
              <Text fw={600}>Новая заявка</Text>
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
                  step={1}
                  value={hours}
                  onChange={setHours}
                  required
                  w={120}
                />
                <Button
                  loading={creating}
                  onClick={createRequest}
                  disabled={!date || Number(hours) <= 0 || (!isSelfView && !teacherId)}
                >
                  Отправить
                </Button>
              </Group>
              <Textarea
                label="Причина"
                minRows={2}
                value={reason}
                onChange={(event) => setReason(event.currentTarget.value)}
              />
            </Stack>
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
                  <Table.Th>Часы</Table.Th>
                  <Table.Th>Педагог</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Замещающий</Table.Th>
                  <Table.Th>Причина</Table.Th>
                  {canDecide && <Table.Th>Действия</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {requests.map((request) => (
                  <Table.Tr key={request.id}>
                    <Table.Td>{formatDate(request.date)}</Table.Td>
                    <Table.Td>{request.hours}</Table.Td>
                    <Table.Td>{formatTeacherName(request.teacher)}</Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_COLORS[request.status] ?? 'gray'} variant="light">
                        {STATUS_LABELS[request.status] ?? request.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{formatTeacherName(request.substituteTeacher)}</Table.Td>
                    <Table.Td>{request.reason || '—'}</Table.Td>
                    {canDecide && (
                      <Table.Td>
                        {request.status === 'pending' ? (
                          <Group gap={4} wrap="nowrap">
                            <Tooltip label="Одобрить">
                              <ActionIcon
                                variant="subtle"
                                color="green"
                                onClick={() => openDecision(request, 'approved')}
                              >
                                <IconCheck size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Отклонить">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                onClick={() => openDecision(request, 'rejected')}
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        ) : (
                          <Text size="sm" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
                {requests.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={canDecide ? 7 : 6}>
                      <Text ta="center" c="dimmed" py="lg">
                        Заявок нет
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </Box>

        <Modal
          opened={Boolean(decision)}
          onClose={() => setDecision(null)}
          title={decision ? STATUS_LABELS[decision.status] : 'Решение'}
        >
          <Stack gap="sm">
            <Text size="sm">
              {decision ? `${formatTeacherName(decision.request.teacher)}: ${formatDate(decision.request.date)}, ${decision.request.hours} ч.` : ''}
            </Text>
            <Select
              label="Замещающий педагог"
              placeholder="Не назначен"
              data={teacherOptions}
              value={substituteTeacherId}
              onChange={setSubstituteTeacherId}
              searchable
              clearable
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDecision(null)}>
                Отмена
              </Button>
              <Button
                color={decision?.status === 'rejected' ? 'red' : 'green'}
                loading={savingDecision}
                onClick={submitDecision}
              >
                Сохранить
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </RoleGate>
  );
}
