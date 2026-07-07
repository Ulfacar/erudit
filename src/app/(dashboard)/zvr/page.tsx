'use client';

import Link from 'next/link';
import type { Role } from '@prisma/client';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconEye,
  IconEyeOff,
  IconLayoutDashboard,
  IconPlayerPlay,
  IconRadar,
  IconUserCheck,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { Sensitive, useZvrBlur } from '@/modules/zvr/Sensitive';
import { ZVR_BEHAVIOR_LEVEL_LABELS } from '@/modules/zvr/labels';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];

type BehaviorLevel = keyof typeof ZVR_BEHAVIOR_LEVEL_LABELS;

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  error?: { message?: string };
};

type DashboardQueueItem = {
  id: string;
  type: string;
  description: string;
  level: BehaviorLevel;
  status: 'pending' | 'moderated' | 'resolved';
  createdAt: string;
  student: { id: string; fio: string; class: string | null };
};

type DisciplineTopItem = {
  classId: string;
  className: string;
  incidents: number;
};

type ZvrDashboardData = {
  queue: DashboardQueueItem[];
  disciplineTop: DisciplineTopItem[];
};

type SupervisionCase = {
  id: string;
  studentId: string;
  sessionsPlanned: number;
  sessionsDone: number;
  student: { id: string; fio: string; class: string | null };
};

type CohesionClass = {
  classId: string;
  className: string;
  participatedEvents: number;
  lastParticipation: string | null;
  isolated: boolean;
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  aggression: 'Агрессия',
  rudeness: 'Грубость',
  bullying: 'Буллинг',
  disruption: 'Нарушение дисциплины',
  other: 'Другое',
};

async function fetchData<T>(url: string) {
  const response = await fetch(url);
  const json = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok || json.success === false) {
    throw new Error(json.error?.message ?? 'Не удалось загрузить данные');
  }
  return json.data as T;
}

function typeLabel(type: string) {
  return INCIDENT_TYPE_LABELS[type] ?? type;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function QueueBlock({
  items,
  loading,
  blurred,
  onTake,
  takingId,
}: {
  items: DashboardQueueItem[];
  loading: boolean;
  blurred: boolean;
  onTake: (id: string) => void;
  takingId?: string;
}) {
  return (
    <Paper withBorder radius="sm" p="md" h="100%">
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs">
            <ThemeIcon color="red" variant="light" radius="sm">
              <IconAlertTriangle size={18} />
            </ThemeIcon>
            <div>
              <Title order={3}>Очередь реагирования</Title>
              <Text size="sm" c="dimmed">Новые ЧП за 24 часа</Text>
            </div>
          </Group>
          <Badge color={items.length > 0 ? 'red' : 'green'} variant="light" radius="sm">
            {items.length}
          </Badge>
        </Group>

        {loading ? (
          <Group justify="center" p="xl"><Loader size="sm" /></Group>
        ) : items.length === 0 ? (
          <Text c="dimmed" size="sm">Новых инцидентов за сутки нет.</Text>
        ) : (
          <ScrollArea h={520} type="auto" offsetScrollbars>
            <Stack gap="sm" pr="xs">
              {items.map((incident) => (
                <Paper key={incident.id} withBorder radius="sm" p="sm">
                  <Stack gap={8}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Text fw={700} size="sm" lineClamp={2}>{typeLabel(incident.type)}</Text>
                      <Badge color={incident.level === 'high' ? 'red' : incident.level === 'medium' ? 'yellow' : 'gray'} variant="light" radius="sm">
                        {ZVR_BEHAVIOR_LEVEL_LABELS[incident.level]}
                      </Badge>
                    </Group>
                    <Group gap="xs">
                      <Anchor component={Link} href={`/zvr/students/${incident.student.id}`} fw={600} size="sm">
                        <Sensitive blurred={blurred}>{incident.student.fio}</Sensitive>
                      </Anchor>
                      <Badge color="gray" variant="outline" radius="sm">
                        {incident.student.class ?? 'Без класса'}
                      </Badge>
                      <Text size="xs" c="dimmed">{formatTime(incident.createdAt)}</Text>
                    </Group>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconPlayerPlay size={14} />}
                      loading={takingId === incident.id}
                      onClick={() => onTake(incident.id)}
                    >
                      Взять в работу
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>
        )}
      </Stack>
    </Paper>
  );
}

function SupervisionBlock({
  cases,
  loading,
  blurred,
}: {
  cases: SupervisionCase[];
  loading: boolean;
  blurred: boolean;
}) {
  return (
    <Paper withBorder radius="sm" p="md" h="100%">
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs">
            <ThemeIcon color="blue" variant="light" radius="sm">
              <IconUserCheck size={18} />
            </ThemeIcon>
            <div>
              <Title order={3}>Требуют внимания</Title>
              <Text size="sm" c="dimmed">Открытые циклы сопровождения</Text>
            </div>
          </Group>
          <Badge color={cases.length > 0 ? 'orange' : 'green'} variant="light" radius="sm">
            {cases.length}
          </Badge>
        </Group>

        {loading ? (
          <Group justify="center" p="xl"><Loader size="sm" /></Group>
        ) : cases.length === 0 ? (
          <Text c="dimmed" size="sm">Нет учеников с незавершённым циклом бесед.</Text>
        ) : (
          <ScrollArea h={520} type="auto" offsetScrollbars>
            <Stack gap="sm" pr="xs">
              {cases.map((item) => (
                <Paper key={item.id} withBorder radius="sm" p="sm">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <div>
                      <Anchor component={Link} href={`/zvr/students/${item.studentId}`} fw={700} size="sm">
                        <Sensitive blurred={blurred}>{item.student.fio}</Sensitive>
                      </Anchor>
                      <Group gap="xs" mt={4}>
                        <Badge color="gray" variant="outline" radius="sm">
                          {item.student.class ?? 'Без класса'}
                        </Badge>
                        <Badge color="blue" variant="light" radius="sm">
                          Сессия {item.sessionsDone + 1} из {item.sessionsPlanned}
                        </Badge>
                      </Group>
                    </div>
                    <Anchor component={Link} href={`/zvr/students/${item.studentId}`} size="sm">
                      Мой контроль
                    </Anchor>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>
        )}
      </Stack>
    </Paper>
  );
}

function RadarBlock({
  disciplineTop,
  isolated,
  loading,
}: {
  disciplineTop: DisciplineTopItem[];
  isolated: CohesionClass[];
  loading: boolean;
}) {
  return (
    <Paper withBorder radius="sm" p="md" h="100%">
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs">
            <ThemeIcon color="grape" variant="light" radius="sm">
              <IconRadar size={18} />
            </ThemeIcon>
            <div>
              <Title order={3}>Радар сплочения</Title>
              <Text size="sm" c="dimmed">Дисциплина и изоляция классов</Text>
            </div>
          </Group>
          <Anchor component={Link} href="/zvr/culture" size="sm">Подробнее</Anchor>
        </Group>

        {loading ? (
          <Group justify="center" p="xl"><Loader size="sm" /></Group>
        ) : (
          <Stack gap="lg">
            <Stack gap="xs">
              <Text fw={700}>Хуже по дисциплине за 7 дней</Text>
              {disciplineTop.length === 0 ? (
                <Text size="sm" c="dimmed">Инцидентов за неделю нет.</Text>
              ) : disciplineTop.map((item) => (
                <Group key={item.classId} justify="space-between">
                  <Badge color="red" variant="light" radius="sm">{item.className}</Badge>
                  <Text size="sm">{item.incidents} инцид.</Text>
                </Group>
              ))}
            </Stack>

            <Stack gap="xs">
              <Text fw={700}>Изолированные классы</Text>
              {isolated.length === 0 ? (
                <Text size="sm" c="dimmed">Изолированных классов нет.</Text>
              ) : isolated.map((item) => (
                <Group key={item.classId} justify="space-between">
                  <Badge color="gray" variant="outline" radius="sm">{item.className}</Badge>
                  <Text size="sm">{item.participatedEvents} мер.</Text>
                </Group>
              ))}
            </Stack>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function ZvrDashboard() {
  const queryClient = useQueryClient();
  const { blurred, toggleBlur } = useZvrBlur();

  const dashboard = useQuery<ZvrDashboardData>({
    queryKey: ['zvr-dashboard'],
    queryFn: () => fetchData<ZvrDashboardData>('/api/v1/zvr/dashboard'),
  });
  const supervision = useQuery<SupervisionCase[]>({
    queryKey: ['zvr-supervision'],
    queryFn: () => fetchData<SupervisionCase[]>('/api/v1/zvr/supervision'),
  });
  const cohesion = useQuery<CohesionClass[]>({
    queryKey: ['zvr-cohesion'],
    queryFn: () => fetchData<CohesionClass[]>('/api/v1/zvr/cohesion'),
  });

  const takeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/zvr/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'moderated' }),
      });
      const json = await response.json().catch(() => ({})) as ApiResponse<DashboardQueueItem>;
      if (!response.ok || json.success === false) {
        throw new Error(json.error?.message ?? 'Не удалось обновить статус инцидента');
      }
      return json.data;
    },
    onSuccess: async () => {
      notifications.show({ color: 'green', title: 'Инцидент взят в работу', message: 'Очередь реагирования обновлена' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zvr-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['zvr-incidents'] }),
        queryClient.invalidateQueries({ queryKey: ['zvr-supervision'] }),
      ]);
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось обновить статус инцидента',
      });
    },
  });

  const pendingSupervision = (supervision.data ?? [])
    .filter((item) => item.sessionsDone < item.sessionsPlanned)
    .slice(0, 15);
  const isolated = (cohesion.data ?? []).filter((item) => item.isolated).slice(0, 3);
  const hasError = dashboard.isError || supervision.isError || cohesion.isError;

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <ThemeIcon size={42} radius="sm" color="indigo" variant="light">
            <IconLayoutDashboard size={22} />
          </ThemeIcon>
          <div>
            <Title order={2}>Дашборд ЗВР</Title>
            <Text size="sm" c="dimmed">Пульт реагирования и сопровождения на сегодня</Text>
          </div>
        </Group>
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
      </Group>

      {hasError && (
        <Alert color="red" title="Не удалось загрузить часть данных">
          {[
            dashboard.isError ? errorText(dashboard.error, 'Ошибка дашборда') : null,
            supervision.isError ? errorText(supervision.error, 'Ошибка сопровождения') : null,
            cohesion.isError ? errorText(cohesion.error, 'Ошибка радара') : null,
          ].filter(Boolean).join(' · ')}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <QueueBlock
          items={dashboard.data?.queue ?? []}
          loading={dashboard.isLoading}
          blurred={blurred}
          onTake={(id) => takeMutation.mutate(id)}
          takingId={takeMutation.isPending ? takeMutation.variables : undefined}
        />
        <SupervisionBlock
          cases={pendingSupervision}
          loading={supervision.isLoading}
          blurred={blurred}
        />
        <RadarBlock
          disciplineTop={dashboard.data?.disciplineTop ?? []}
          isolated={isolated}
          loading={dashboard.isLoading || cohesion.isLoading}
        />
      </SimpleGrid>
    </Stack>
  );
}

export default function ZvrDashboardPage() {
  return (
    <RoleGate roles={[...ZVR_ROLES]}>
      <ZvrDashboard />
    </RoleGate>
  );
}
