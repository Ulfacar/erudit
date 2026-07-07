'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Role } from '@prisma/client';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendarDue,
  IconEye,
  IconEyeOff,
  IconMessageCircle,
  IconPhone,
  IconSchool,
  IconUserCheck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { Sensitive, useZvrBlur } from '@/modules/zvr/Sensitive';
import { ZVR_MEDIATION_PARTY_LABELS } from '@/modules/zvr/labels';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];

type StudentHeader = {
  id: string;
  fio: string;
  className: string;
  parentPhones: string[];
};

type TimelineItem = { date: string; type: string; title: string; detail?: string; source: string };
type StudentNote = {
  id: string;
  type: string;
  text: string;
  role: string;
  createdAt: string;
  meta?: { withWhom?: string; parentResponse?: string } | null;
};
type Obligation = {
  id: string;
  party: 'student' | 'parent';
  task: string;
  deadline: string | null;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
};
type Protocol = { id: string; date: string; agreement: string; obligations: Obligation[] };
type ApiResponse<T> = { success?: boolean; data?: T; error?: { message?: string } };

async function fetchData<T>(url: string) {
  const response = await fetch(url);
  const json = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok || json.success === false) {
    throw new Error(json.error?.message ?? 'Не удалось загрузить данные');
  }
  return json.data as T;
}

function formatDate(value?: string | null) {
  if (!value) return 'Без срока';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function endOfLocalDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function withWhomLabel(value?: string) {
  if (value === 'student') return 'Ученик';
  if (value === 'parent') return 'Родитель';
  if (value === 'both') return 'Ученик и родитель';
  return 'Беседа';
}

function TimelineTab({ studentId, enabled, blurred }: { studentId: string; enabled: boolean; blurred: boolean }) {
  const { data = [], isLoading } = useQuery<TimelineItem[]>({
    queryKey: ['zvr-student-timeline', studentId],
    queryFn: () => fetchData<TimelineItem[]>(`/api/v1/students/${studentId}/timeline`),
    enabled,
  });

  if (isLoading) return <Group justify="center" p="xl"><Loader /></Group>;
  if (data.length === 0) return <Text c="dimmed">Событий пока нет.</Text>;

  return (
    <Timeline active={-1} bulletSize={24} lineWidth={2}>
      {data.map((item, index) => (
        <Timeline.Item
          key={`${item.date}-${index}`}
          bullet={<IconCalendarDue size={14} />}
          color={item.type === 'overdue' ? 'red' : item.type === 'behavior' ? 'orange' : 'blue'}
          title={(
            <Group gap={6}>
              <Text size="sm" fw={600}>{item.title}</Text>
              <Badge size="xs" variant="light">{item.source}</Badge>
            </Group>
          )}
        >
          {item.detail && (
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              <Sensitive blurred={blurred}>{item.detail}</Sensitive>
            </Text>
          )}
          <Text size="xs" c="dimmed" mt={2}>{formatDate(item.date)}</Text>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

function TalksTab({ studentId, enabled, blurred }: { studentId: string; enabled: boolean; blurred: boolean }) {
  const { data = [], isLoading } = useQuery<StudentNote[]>({
    queryKey: ['zvr-student-talks', studentId],
    queryFn: async () => {
      const notes = await fetchData<StudentNote[]>(`/api/v1/students/${studentId}/notes`);
      return (notes ?? []).filter((note) => note.type === 'conversation');
    },
    enabled,
  });

  if (isLoading) return <Group justify="center" p="xl"><Loader /></Group>;
  if (data.length === 0) return <Text c="dimmed">Бесед пока не зафиксировано.</Text>;

  const grouped = {
    student: data.filter((note) => note.meta?.withWhom === 'student'),
    parent: data.filter((note) => note.meta?.withWhom === 'parent' || note.meta?.withWhom === 'both'),
    other: data.filter((note) => !note.meta?.withWhom),
  };

  return (
    <Stack gap="md">
      {([
        ['student', 'С учеником'],
        ['parent', 'С родителем'],
        ['other', 'Без уточнения'],
      ] as const).map(([key, title]) => grouped[key].length > 0 && (
        <Stack key={key} gap="xs">
          <Text fw={700}>{title}</Text>
          {grouped[key].map((note) => (
            <Paper key={note.id} withBorder radius="sm" p="sm">
              <Group gap="xs" mb={4}>
                <Badge color="grape" variant="light" leftSection={<IconMessageCircle size={11} />}>
                  {withWhomLabel(note.meta?.withWhom)}
                </Badge>
                <Text size="xs" c="dimmed">{formatDate(note.createdAt)}</Text>
              </Group>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                <Sensitive blurred={blurred}>{note.text}</Sensitive>
              </Text>
              {note.meta?.parentResponse && (
                <Text size="sm" c="dimmed" mt={6}>
                  <b>Ответ родителя:</b>{' '}
                  <Sensitive blurred={blurred}>{note.meta.parentResponse}</Sensitive>
                </Text>
              )}
            </Paper>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

function ObligationsTab({ studentId, enabled, blurred }: { studentId: string; enabled: boolean; blurred: boolean }) {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery<Protocol[]>({
    queryKey: ['zvr-mediation', { studentId }],
    queryFn: () => fetchData<Protocol[]>(`/api/v1/zvr/mediation?studentId=${studentId}`),
    enabled,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const response = await fetch(`/api/v1/zvr/mediation/obligations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done }),
      });
      const json = await response.json().catch(() => ({})) as ApiResponse<Obligation>;
      if (!response.ok || json.success === false) {
        throw new Error(json.error?.message ?? 'Не удалось обновить обязательство');
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zvr-mediation', { studentId }] });
      queryClient.invalidateQueries({ queryKey: ['zvr-mediation'] });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось обновить обязательство',
      });
    },
  });

  const obligations = data.flatMap((protocol) => protocol.obligations.map((obligation) => ({ ...obligation, protocol })));
  const byParty = {
    student: obligations.filter((item) => item.party === 'student'),
    parent: obligations.filter((item) => item.party === 'parent'),
  };

  if (isLoading) return <Group justify="center" p="xl"><Loader /></Group>;
  if (obligations.length === 0) {
    return <Text c="dimmed">Обязательств пока нет. Новый протокол создаётся в разделе «Работа с семьёй».</Text>;
  }

  return (
    <Stack gap="md">
      {(['student', 'parent'] as const).map((party) => (
        <Stack key={party} gap="xs">
          <Group gap="xs">
            <Text fw={700}>{ZVR_MEDIATION_PARTY_LABELS[party]}</Text>
            <Badge variant="light">{byParty[party].filter((item) => item.done).length}/{byParty[party].length}</Badge>
          </Group>
          {byParty[party].length === 0 ? (
            <Text size="sm" c="dimmed">Нет обязательств.</Text>
          ) : byParty[party].map((item) => {
            const overdue = Boolean(item.deadline && !item.done && endOfLocalDay(item.deadline) < new Date());
            return (
              <Paper key={item.id} withBorder radius="sm" p="sm">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Checkbox
                    checked={item.done}
                    disabled={toggleMutation.isPending}
                    onChange={(event) => toggleMutation.mutate({ id: item.id, done: event.currentTarget.checked })}
                    label={<Text size="sm" style={{ whiteSpace: 'pre-wrap' }}><Sensitive blurred={blurred}>{item.task}</Sensitive></Text>}
                  />
                  <Badge color={overdue ? 'red' : item.done ? 'green' : 'gray'} variant="light" radius="sm">
                    {item.done ? 'Выполнено' : item.deadline ? formatDate(item.deadline) : 'Без срока'}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={6}>
                  Протокол от {formatDate(item.protocol.date)}:{' '}
                  <Sensitive blurred={blurred}>{item.protocol.agreement}</Sensitive>
                </Text>
              </Paper>
            );
          })}
        </Stack>
      ))}
    </Stack>
  );
}

function ZvrStudentControl() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const { blurred, toggleBlur } = useZvrBlur();
  const header = useQuery<StudentHeader>({
    queryKey: ['zvr-student', studentId],
    queryFn: () => fetchData<StudentHeader>(`/api/v1/zvr/students/${studentId}`),
  });
  const student = header.data;

  return (
    <Stack gap="md">
      <Anchor component={Link} href="/zvr/incidents" size="sm">
        <Group gap={6}><IconArrowLeft size={14} /> Инциденты и Сессии</Group>
      </Anchor>

      <Paper withBorder radius="sm" p="md">
        {header.isLoading ? (
          <Group justify="center"><Loader /></Group>
        ) : student ? (
          <Group justify="space-between" align="flex-start">
            <Group gap="sm">
              <ThemeIcon size={42} radius="sm" color="blue" variant="light">
                <IconSchool size={22} />
              </ThemeIcon>
              <div>
                <Title order={2}>Мой контроль</Title>
                <Text fw={700}><Sensitive blurred={blurred}>{student.fio}</Sensitive></Text>
                <Text size="sm" c="dimmed">{student.className}</Text>
              </div>
            </Group>
            <Group gap="xs">
              <Tooltip label={blurred ? 'Показать чувствительные данные' : 'Скрыть чувствительные данные'}>
                <ActionIcon
                  variant={blurred ? 'filled' : 'light'}
                  color={blurred ? 'red' : 'gray'}
                  size="lg"
                  aria-label={blurred ? 'Показать чувствительные данные' : 'Скрыть чувствительные данные'}
                  onClick={toggleBlur}
                >
                  {blurred ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </ActionIcon>
              </Tooltip>
              {student.parentPhones.length > 0 ? student.parentPhones.map((phone) => (
                <Button key={phone} component="a" href={`tel:${phone}`} variant="light" leftSection={<IconPhone size={16} />}>
                  <Sensitive blurred={blurred}>{phone}</Sensitive>
                </Button>
              )) : <Badge color="gray" variant="light">Нет телефона родителя</Badge>}
            </Group>
          </Group>
        ) : (
          <Text c="red">Нет доступа к ученику</Text>
        )}
      </Paper>

      {header.isSuccess && (
        <Tabs defaultValue="timeline" variant="outline">
          <Tabs.List>
            <Tabs.Tab value="timeline" leftSection={<IconCalendarDue size={16} />}>Хроника</Tabs.Tab>
            <Tabs.Tab value="talks" leftSection={<IconMessageCircle size={16} />}>Беседы</Tabs.Tab>
            <Tabs.Tab value="obligations" leftSection={<IconUserCheck size={16} />}>Обязательства</Tabs.Tab>
          </Tabs.List>
          <Paper withBorder radius="sm" p="md" mt="md">
            <Tabs.Panel value="timeline"><TimelineTab studentId={studentId} enabled={header.isSuccess} blurred={blurred} /></Tabs.Panel>
            <Tabs.Panel value="talks"><TalksTab studentId={studentId} enabled={header.isSuccess} blurred={blurred} /></Tabs.Panel>
            <Tabs.Panel value="obligations"><ObligationsTab studentId={studentId} enabled={header.isSuccess} blurred={blurred} /></Tabs.Panel>
          </Paper>
        </Tabs>
      )}

      <Divider />
      <Group gap="xs" c="dimmed">
        <IconAlertTriangle size={16} />
        <Text size="sm">Психологические сессии в хронике показываются только фактом проведения.</Text>
      </Group>
    </Stack>
  );
}

export default function ZvrStudentControlPage() {
  return (
    <RoleGate roles={[...ZVR_ROLES]}>
      <ZvrStudentControl />
    </RoleGate>
  );
}
