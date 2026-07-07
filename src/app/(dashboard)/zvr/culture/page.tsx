'use client';

import { useMemo, useState } from 'react';
import type { Role } from '@prisma/client';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Indicator,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCalendarHeart, IconMapPin, IconPlus, IconRadar } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { EVENT_SOCIAL_GOAL_COLORS, EVENT_SOCIAL_GOAL_LABELS } from '@/modules/zvr/labels';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];
const EVENT_SOCIAL_GOALS = Object.keys(EVENT_SOCIAL_GOAL_LABELS) as EventSocialGoal[];

type EventSocialGoal = keyof typeof EVENT_SOCIAL_GOAL_LABELS;

type CohesionClass = {
  classId: string;
  className: string;
  participatedEvents: number;
  lastParticipation: string | null;
  isolated: boolean;
};

type SchoolEvent = {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  endDate?: string | null;
  location?: string | null;
  socialGoal?: EventSocialGoal | null;
  targetClassIds?: string[];
};

type SchoolClass = {
  id: string;
  grade: number;
  letter: string;
};

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  error?: { message?: string };
};

const localKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayKey = (iso: string) => iso.slice(0, 10);

async function fetchData<T>(url: string) {
  const response = await fetch(url);
  const json = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok || json.success === false) {
    throw new Error(json.error?.message ?? 'Не удалось загрузить данные');
  }
  return json.data ?? ([] as T);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function classLabel(item: SchoolClass) {
  return `${item.grade}${item.letter}`;
}

function socialGoalColor(goal?: EventSocialGoal | null) {
  return goal ? EVENT_SOCIAL_GOAL_COLORS[goal] : 'gray';
}

function CohesionRadar({ data, loading }: { data: CohesionClass[]; loading: boolean }) {
  const isolated = data.filter((item) => item.isolated).slice(0, 6);
  const activeCount = data.length - data.filter((item) => item.isolated).length;

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs">
            <IconRadar size={22} color="var(--mantine-color-indigo-6)" />
            <div>
              <Title order={3}>Радар сплочения</Title>
              <Text size="sm" c="dimmed">Участие классов в мероприятиях за последние 4 недели</Text>
            </div>
          </Group>
          <Badge color={isolated.length > 0 ? 'red' : 'green'} variant="light" radius="sm">
            {activeCount} из {data.length} участвовали
          </Badge>
        </Group>

        {loading ? (
          <Group justify="center" p="lg"><Loader size="sm" /></Group>
        ) : (
          <>
            <Group gap={6}>
              {data.map((item) => (
                <Tooltip
                  key={item.classId}
                  label={`${item.className}: ${item.participatedEvents} мер., последнее: ${item.lastParticipation ? formatDate(item.lastParticipation) : 'нет'}`}
                >
                  <Badge
                    color={item.isolated ? 'gray' : 'green'}
                    variant={item.isolated ? 'outline' : 'filled'}
                    radius="sm"
                  >
                    {item.className}
                  </Badge>
                </Tooltip>
              ))}
            </Group>

            <Stack gap="xs">
              <Text fw={700}>Топ изолированных классов</Text>
              {isolated.length === 0 ? (
                <Text size="sm" c="dimmed">Нет изолированных классов в выбранном окне.</Text>
              ) : (
                <Group gap="xs">
                  {isolated.map((item) => (
                    <Badge key={item.classId} color="red" variant="light" radius="sm">
                      {item.className}
                    </Badge>
                  ))}
                </Group>
              )}
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}

function CultureCalendar({
  events,
  selected,
  onSelect,
}: {
  events: SchoolEvent[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, SchoolEvent[]>();
    for (const event of events) {
      const key = dayKey(event.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);
  const selectedEvents = byDay.get(selected) ?? [];

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <Paper withBorder radius="md" p="md">
        <Calendar
          size="lg"
          getDayProps={(date) => {
            const key = localKey(date);
            return { selected: key === selected, onClick: () => onSelect(key) };
          }}
          renderDay={(date) => {
            const key = localKey(date);
            const dayEvents = byDay.get(key) ?? [];
            const color = socialGoalColor(dayEvents[0]?.socialGoal);
            return (
              <Indicator size={7} color={color} offset={-2} disabled={dayEvents.length === 0}>
                <div>{date.getDate()}</div>
              </Indicator>
            );
          }}
        />
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Stack gap="sm">
          <Text fw={700}>{formatDate(selected)}</Text>
          {selectedEvents.length === 0 ? (
            <Text size="sm" c="dimmed">На этот день мероприятий нет.</Text>
          ) : (
            selectedEvents.map((event) => (
              <Paper key={event.id} withBorder radius="sm" p="sm">
                <Stack gap={6}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Text fw={700} size="sm">{event.title}</Text>
                    {event.socialGoal && (
                      <Badge color={socialGoalColor(event.socialGoal)} variant="light" radius="sm">
                        {EVENT_SOCIAL_GOAL_LABELS[event.socialGoal]}
                      </Badge>
                    )}
                  </Group>
                  {event.location && (
                    <Group gap={4}>
                      <IconMapPin size={13} />
                      <Text size="xs" c="dimmed">{event.location}</Text>
                    </Group>
                  )}
                  {event.description && <Text size="sm">{event.description}</Text>}
                  {event.targetClassIds && event.targetClassIds.length > 0 && (
                    <Text size="xs" c="dimmed">Целевых классов: {event.targetClassIds.length}</Text>
                  )}
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </Paper>
    </SimpleGrid>
  );
}

function AddCultureEventModal({
  opened,
  defaultDate,
  classes,
  onClose,
}: {
  opened: boolean;
  defaultDate: string;
  classes: SchoolClass[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    date: defaultDate,
    endDate: '',
    location: '',
    description: '',
    socialGoal: 'integration' as EventSocialGoal,
    targetClassIds: [] as string[],
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          date: form.date,
          endDate: form.endDate || null,
          location: form.location.trim() || null,
          description: form.description.trim() || null,
          socialGoal: form.socialGoal,
          targetClassIds: form.targetClassIds,
        }),
      });
      const json = await response.json().catch(() => ({})) as ApiResponse<SchoolEvent>;
      if (!response.ok || json.success === false) {
        throw new Error(json.error?.message ?? 'Не удалось создать мероприятие');
      }
      return json.data;
    },
    onSuccess: async () => {
      notifications.show({ color: 'green', title: 'Мероприятие создано', message: 'Календарь и радар обновлены' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zvr-culture-events'] }),
        queryClient.invalidateQueries({ queryKey: ['zvr-cohesion'] }),
      ]);
      onClose();
    },
    onError: (error) => {
      notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось создать мероприятие' });
    },
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (!form.title.trim() || !form.date) {
      notifications.show({ color: 'red', title: 'Заполните поля', message: 'Название и дата обязательны' });
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Новое мероприятие" centered size="lg">
      <Stack gap="sm">
        <TextInput label="Название" required value={form.title} onChange={(event) => update('title', event.currentTarget.value)} />
        <Group grow>
          <TextInput label="Дата" type="date" required value={form.date} onChange={(event) => update('date', event.currentTarget.value)} />
          <TextInput label="Дата окончания" type="date" value={form.endDate} onChange={(event) => update('endDate', event.currentTarget.value)} />
        </Group>
        <Select
          label="Социальная цель"
          value={form.socialGoal}
          data={EVENT_SOCIAL_GOALS.map((goal) => ({ value: goal, label: EVENT_SOCIAL_GOAL_LABELS[goal] }))}
          onChange={(value) => {
            if (value) update('socialGoal', value as EventSocialGoal);
          }}
        />
        <TextInput label="Место проведения" value={form.location} onChange={(event) => update('location', event.currentTarget.value)} />
        <Textarea label="Описание" autosize minRows={2} value={form.description} onChange={(event) => update('description', event.currentTarget.value)} />
        <Stack gap={6}>
          <Text fw={600} size="sm">Целевые классы</Text>
          <ScrollArea h={180} type="auto">
            <Checkbox.Group value={form.targetClassIds} onChange={(value) => update('targetClassIds', value)}>
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                {classes.map((item) => (
                  <Checkbox key={item.id} value={item.id} label={classLabel(item)} />
                ))}
              </SimpleGrid>
            </Checkbox.Group>
          </ScrollArea>
        </Stack>
        <Text size="xs" c="dimmed">Ответственный назначается автоматически: текущий пользователь.</Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button loading={mutation.isPending} onClick={submit}>Создать</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function CultureAndCohesionPage() {
  const [selected, setSelected] = useState(() => localKey(new Date()));
  const [createOpen, setCreateOpen] = useState(false);

  const cohesionQuery = useQuery<CohesionClass[]>({
    queryKey: ['zvr-cohesion'],
    queryFn: () => fetchData<CohesionClass[]>('/api/v1/zvr/cohesion'),
  });
  const eventsQuery = useQuery<SchoolEvent[]>({
    queryKey: ['zvr-culture-events'],
    queryFn: () => fetchData<SchoolEvent[]>('/api/v1/events'),
  });
  const classesQuery = useQuery<SchoolClass[]>({
    queryKey: ['zvr-culture-classes'],
    queryFn: () => fetchData<SchoolClass[]>('/api/v1/classes'),
  });

  return (
    <RoleGate roles={[...ZVR_ROLES]}>
      <Stack gap="lg" p="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs">
            <IconCalendarHeart size={26} color="var(--mantine-color-grape-6)" />
            <div>
              <Title order={2}>Культура и Сплочение</Title>
              <Text size="sm" c="dimmed">Календарь социальных целей и вовлечённость классов</Text>
            </div>
          </Group>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
            Создать мероприятие
          </Button>
        </Group>

        {cohesionQuery.isError ? (
          <Alert color="red" title="Не удалось загрузить радар сплочения">
            {errorMessage(cohesionQuery.error, 'Повторите попытку позже.')}
          </Alert>
        ) : (
          <CohesionRadar data={cohesionQuery.data ?? []} loading={cohesionQuery.isLoading} />
        )}

        {classesQuery.isError && (
          <Alert color="red" title="Не удалось загрузить классы">
            {errorMessage(classesQuery.error, 'Создание мероприятия временно недоступно.')}
          </Alert>
        )}

        <Paper withBorder radius="md" p="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={3}>Календарь мероприятий</Title>
              {eventsQuery.isLoading && <Loader size="sm" />}
            </Group>
            {eventsQuery.isError ? (
              <Alert color="red" title="Не удалось загрузить мероприятия">
                {errorMessage(eventsQuery.error, 'Повторите попытку позже.')}
              </Alert>
            ) : (
              <CultureCalendar
                events={eventsQuery.data ?? []}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </Stack>
        </Paper>

        {createOpen && (
          <AddCultureEventModal
            opened={createOpen}
            defaultDate={selected}
            classes={classesQuery.data ?? []}
            onClose={() => setCreateOpen(false)}
          />
        )}
      </Stack>
    </RoleGate>
  );
}

export default CultureAndCohesionPage;
