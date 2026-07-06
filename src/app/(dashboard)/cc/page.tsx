'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconPlus, IconSearch, IconTrafficLights } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CC_CONFLICT_STATUS_LABELS } from '@/modules/cc/labels';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const CC_ROLES = ['college_counselor', 'super_admin'] as const;
const CONFLICTS = [
  { value: 'green', label: CC_CONFLICT_STATUS_LABELS.green },
  { value: 'yellow', label: CC_CONFLICT_STATUS_LABELS.yellow },
  { value: 'red', label: CC_CONFLICT_STATUS_LABELS.red },
];

type CcProfileRow = {
  id: string;
  studentId: string;
  fio: string;
  className: string;
  studentMajor?: string | null;
  studentCountries: string[];
  conflictStatus: 'green' | 'yellow' | 'red';
  riskFlagCleared: boolean;
  gpa: number | null;
  nearestDeadline: string | null;
  lastContact: string | null;
  nextStep: string | null;
  applicationsCount: number;
  strategyAssigned: boolean;
};

type StudentOption = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  class?: { grade: number; letter: string };
};

function dateText(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function daysLeft(value?: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function ConflictDot({ value }: { value: CcProfileRow['conflictStatus'] }) {
  const color = value === 'red' ? 'red' : value === 'yellow' ? 'yellow' : 'green';
  return <ThemeIcon size={18} radius="xl" color={color} variant="filled" aria-label={CC_CONFLICT_STATUS_LABELS[value]} />;
}

function CcDesk() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [className, setClassName] = useState('');
  const [country, setCountry] = useState('');
  const [search, setSearch] = useState('');
  const [conflictStatus, setConflictStatus] = useState<string | null>(null);
  const [withoutStrategy, setWithoutStrategy] = useState(false);
  const [opened, setOpened] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (className.trim()) p.set('className', className.trim());
    if (country.trim()) p.set('country', country.trim());
    if (search.trim()) p.set('search', search.trim());
    if (conflictStatus) p.set('conflictStatus', conflictStatus);
    if (withoutStrategy) p.set('strategyAssigned', 'false');
    return p.toString();
  }, [className, country, conflictStatus, search, withoutStrategy]);

  const { data: profiles = [], isLoading } = useQuery<CcProfileRow[]>({
    queryKey: ['cc-profiles', params],
    queryFn: async () => {
      const res = await fetch(`/api/v1/cc/profiles${params ? `?${params}` : ''}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить профили');
      return json.data;
    },
  });

  const { data: students = [] } = useQuery<StudentOption[]>({
    queryKey: ['students-for-cc'],
    queryFn: async () => {
      const res = await fetch('/api/v1/students');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить учеников');
      return json.data;
    },
    enabled: opened,
  });

  const createMutation = useMutation({
    mutationFn: async (nextStudentId: string) => {
      const res = await fetch('/api/v1/cc/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: nextStudentId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось создать профиль');
      return json.data as { id: string };
    },
    onSuccess: (created) => {
      notifications.show({ color: 'green', title: 'Готово', message: 'Ученик добавлен в CC' });
      setOpened(false);
      setStudentId(null);
      queryClient.invalidateQueries({ queryKey: ['cc-profiles'] });
      router.push(`/cc/${created.id}`);
    },
    onError: (err) => notifications.show({ color: 'red', title: 'Ошибка', message: err instanceof Error ? err.message : 'Не удалось создать профиль' }),
  });

  const existingStudentIds = new Set(profiles.map((profile) => profile.studentId));
  const studentOptions = students
    .filter((student) => !existingStudentIds.has(student.id))
    .map((student) => ({
      value: student.id,
      label: `${student.lastName} ${student.firstName}${student.middleName ? ` ${student.middleName}` : ''}${student.class ? ` · ${student.class.grade}${student.class.letter}` : ''}`,
    }));

  const riskRows = profiles.filter((profile) => profile.conflictStatus === 'red' && !profile.riskFlagCleared);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <ThemeIcon size={40} radius="sm" color="green" variant="light">
            <IconTrafficLights size={22} />
          </ThemeIcon>
          <div>
            <Title order={2}>Колледж-консалтинг</Title>
            <Text size="sm" c="dimmed">Рабочий стол «Светофор»</Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          Добавить ученика
        </Button>
      </Group>

      {riskRows.length > 0 && (
        <Paper withBorder radius="sm" p="md" style={{ borderColor: 'var(--mantine-color-red-4)' }}>
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconAlertTriangle size={18} color="var(--mantine-color-red-6)" />
              <Text fw={700}>Зона риска</Text>
            </Group>
            <Badge color="red" variant="light" radius="sm">{riskRows.length}</Badge>
          </Group>
          <Group gap="xs">
            {riskRows.slice(0, 6).map((profile) => (
              <Button key={profile.id} size="xs" variant="light" color="red" onClick={() => router.push(`/cc/${profile.id}`)}>
                {profile.fio}
              </Button>
            ))}
          </Group>
        </Paper>
      )}

      <Paper withBorder radius="sm" p="md">
        <Group align="flex-end" gap="sm">
          <TextInput label="Поиск" placeholder="ФИО" value={search} onChange={(e) => setSearch(e.currentTarget.value)} leftSection={<IconSearch size={16} />} />
          <TextInput label="Класс" placeholder="10A" value={className} onChange={(e) => setClassName(e.currentTarget.value)} w={120} />
          <TextInput label="Страна" placeholder="USA" value={country} onChange={(e) => setCountry(e.currentTarget.value)} w={180} />
          <Select label="Конфликт" data={CONFLICTS} value={conflictStatus} onChange={setConflictStatus} clearable w={150} />
          <Checkbox label="Без стратегии" checked={withoutStrategy} onChange={(e) => setWithoutStrategy(e.currentTarget.checked)} />
        </Group>
      </Paper>

      <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <Group justify="center" py="xl"><Loader /></Group>
        ) : (
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ФИО</Table.Th>
                <Table.Th>Класс</Table.Th>
                <Table.Th>Цель</Table.Th>
                <Table.Th>GPA</Table.Th>
                <Table.Th>Ближайший дедлайн</Table.Th>
                <Table.Th>Последний контакт</Table.Th>
                <Table.Th>Следующий шаг</Table.Th>
                <Table.Th>Конфликт</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {profiles.map((profile) => {
                const days = daysLeft(profile.nearestDeadline);
                return (
                  <Table.Tr key={profile.id} onClick={() => router.push(`/cc/${profile.id}`)} style={{ cursor: 'pointer' }}>
                    <Table.Td><Text fw={600}>{profile.fio}</Text></Table.Td>
                    <Table.Td>{profile.className || '—'}</Table.Td>
                    <Table.Td>
                      <Text size="sm">{[profile.studentMajor, profile.studentCountries.join(', ')].filter(Boolean).join(' · ') || '—'}</Text>
                    </Table.Td>
                    <Table.Td>{profile.gpa == null ? '—' : `${profile.gpa}/5`}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="sm">{dateText(profile.nearestDeadline)}</Text>
                        {days != null && (
                          <Badge color={days <= 7 ? 'red' : days <= 30 ? 'yellow' : 'blue'} variant="light" radius="sm">
                            {days >= 0 ? `${days} дн.` : 'просрочено'}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{dateText(profile.lastContact)}</Table.Td>
                    <Table.Td><Text size="sm" lineClamp={2}>{profile.nextStep || '—'}</Text></Table.Td>
                    <Table.Td><ConflictDot value={profile.conflictStatus} /></Table.Td>
                  </Table.Tr>
                );
              })}
              {profiles.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text c="dimmed" ta="center" py="lg">Нет профилей по выбранным фильтрам</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal opened={opened} onClose={() => setOpened(false)} title="Добавить ученика" centered>
        <Stack gap="sm">
          <Select
            label="Ученик без CC-профиля"
            data={studentOptions}
            value={studentId}
            onChange={setStudentId}
            searchable
            nothingFoundMessage="Нет доступных учеников"
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setOpened(false)}>Отмена</Button>
            <Button loading={createMutation.isPending} disabled={!studentId} onClick={() => studentId && createMutation.mutate(studentId)}>
              Создать
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function CcPage() {
  return (
    <RoleGate roles={[...CC_ROLES]}>
      <CcDesk />
    </RoleGate>
  );
}
