'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Role } from '@prisma/client';
import {
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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconArrowLeft, IconCalendarDue, IconMessageCircle, IconPhone, IconSchool, IconUserCheck } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ZVR_MEDIATION_PARTY_LABELS } from '@/modules/zvr/labels';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];

type StudentHeader = {
  id: string;
  fio: string;
  className: string;
  parentPhones: string[];
};

type TimelineItem = { date: string; type: string; title: string; detail?: string; source: string };
type StudentNote = { id: string; type: string; text: string; role: string; createdAt: string; meta?: { withWhom?: string; parentResponse?: string } | null };
type Obligation = { id: string; party: 'student' | 'parent'; task: string; deadline: string | null; done: boolean; doneAt: string | null; createdAt: string };
type Protocol = { id: string; date: string; agreement: string; obligations: Obligation[] };

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

function TimelineTab({ studentId, enabled }: { studentId: string; enabled: boolean }) {
  const { data = [], isLoading } = useQuery<TimelineItem[]>({
    queryKey: ['zvr-student-timeline', studentId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/students/${studentId}/timeline`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить хронику');
      return json.data;
    },
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
          {item.detail && <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{item.detail}</Text>}
          <Text size="xs" c="dimmed" mt={2}>{formatDate(item.date)}</Text>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

function TalksTab({ studentId, enabled }: { studentId: string; enabled: boolean }) {
  const { data = [], isLoading } = useQuery<StudentNote[]>({
    queryKey: ['zvr-student-talks', studentId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/students/${studentId}/notes`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить беседы');
      return (json.data ?? []).filter((note: StudentNote) => note.type === 'conversation');
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
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{note.text}</Text>
              {note.meta?.parentResponse && (
                <Text size="sm" c="dimmed" mt={6}>
                  <b>Ответ родителя:</b> {note.meta.parentResponse}
                </Text>
              )}
            </Paper>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

function ObligationsTab({ studentId, enabled }: { studentId: string; enabled: boolean }) {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery<Protocol[]>({
    queryKey: ['zvr-mediation', { studentId }],
    queryFn: async () => {
      const res = await fetch(`/api/v1/zvr/mediation?studentId=${studentId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить обязательства');
      return json.data;
    },
    enabled,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const res = await fetch(`/api/v1/zvr/mediation/obligations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось обновить обязательство');
      return json.data as Obligation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zvr-mediation', { studentId }] });
      queryClient.invalidateQueries({ queryKey: ['zvr-mediation'] });
    },
    onError: (err) => {
      notifications.show({ color: 'red', title: 'Ошибка', message: err instanceof Error ? err.message : 'Не удалось обновить обязательство' });
    },
  });

  const obligations = data.flatMap((protocol) => protocol.obligations.map((obligation) => ({ ...obligation, protocol })));
  const byParty = {
    student: obligations.filter((item) => item.party === 'student'),
    parent: obligations.filter((item) => item.party === 'parent'),
  };

  if (isLoading) return <Group justify="center" p="xl"><Loader /></Group>;
  if (obligations.length === 0) return <Text c="dimmed">Обязательств пока нет. Новый протокол создаётся в разделе «Работа с семьёй».</Text>;

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
                    label={<Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{item.task}</Text>}
                  />
                  <Badge color={overdue ? 'red' : item.done ? 'green' : 'gray'} variant="light" radius="sm">
                    {item.done ? 'Выполнено' : item.deadline ? formatDate(item.deadline) : 'Без срока'}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={6}>Протокол от {formatDate(item.protocol.date)}: {item.protocol.agreement}</Text>
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
  const header = useQuery<StudentHeader>({
    queryKey: ['zvr-student', studentId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/zvr/students/${studentId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить ученика');
      return json.data;
    },
  });
  const student = header.data;

  return (
    <Stack gap="md">
      <Anchor component={Link} href="/zvr/incidents" size="sm">
        <Group gap={6}><IconArrowLeft size={14} /> Инциденты и сессии</Group>
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
                <Text fw={700}>{student.fio}</Text>
                <Text size="sm" c="dimmed">{student.className}</Text>
              </div>
            </Group>
            <Group gap="xs">
              {student.parentPhones.length > 0 ? student.parentPhones.map((phone) => (
                <Button key={phone} component="a" href={`tel:${phone}`} variant="light" leftSection={<IconPhone size={16} />}>
                  {phone}
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
          <Tabs.Panel value="timeline"><TimelineTab studentId={studentId} enabled={header.isSuccess} /></Tabs.Panel>
          <Tabs.Panel value="talks"><TalksTab studentId={studentId} enabled={header.isSuccess} /></Tabs.Panel>
          <Tabs.Panel value="obligations"><ObligationsTab studentId={studentId} enabled={header.isSuccess} /></Tabs.Panel>
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
