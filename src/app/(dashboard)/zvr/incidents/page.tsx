'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Role } from '@prisma/client';
import {
  Anchor,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconArchive, IconPlayerPlay, IconUsers } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import {
  ZVR_BEHAVIOR_LEVEL_LABELS,
  ZVR_INCIDENT_ROLE_LABELS,
  ZVR_INCIDENT_STATUS_LABELS,
  ZVR_SUPERVISION_STATUS_LABELS,
} from '@/modules/zvr/labels';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];
const STATUSES = ['pending', 'moderated', 'resolved'] as const;
const SUPERVISION_STATUSES = ['improved', 'no_change', 'needs_council'] as const;
const INCIDENT_TYPE_LABELS: Record<string, string> = {
  aggression: 'Агрессия',
  rudeness: 'Грубость',
  bullying: 'Буллинг',
  disruption: 'Нарушение дисциплины',
  other: 'Другое',
};
const LEVEL_COLORS: Record<BehaviorLevel, string> = {
  low: 'gray',
  medium: 'yellow',
  high: 'red',
};
const ROLE_COLORS: Record<IncidentRole, string> = {
  initiator: 'blue',
  victim: 'red',
  accomplice: 'orange',
  witness: 'gray',
};

type IncidentStatus = (typeof STATUSES)[number];
type IncidentRole = keyof typeof ZVR_INCIDENT_ROLE_LABELS;
type BehaviorLevel = keyof typeof ZVR_BEHAVIOR_LEVEL_LABELS;
type SupervisionStatus = (typeof SUPERVISION_STATUSES)[number];

type StudentBrief = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  class?: { grade: number; letter: string } | null;
};

type IncidentParticipant = {
  id: string;
  role: IncidentRole;
  student: StudentBrief;
};

type ZvrIncident = {
  id: string;
  studentId: string;
  type: string;
  description: string;
  level: BehaviorLevel;
  status: IncidentStatus;
  createdAt: string;
  student: StudentBrief;
  participants: IncidentParticipant[];
};

type SupervisionCase = {
  id: string;
  studentId: string;
  behaviorIncidentId: string | null;
  sessionsPlanned: number;
  sessionsDone: number;
  status: SupervisionStatus;
};

function fio(student: StudentBrief) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

function className(student: StudentBrief) {
  return student.class ? `${student.class.grade}${student.class.letter}` : 'Без класса';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function typeLabel(type: string) {
  return INCIDENT_TYPE_LABELS[type] ?? type;
}

function IncidentCard({
  incident,
  selected,
  onClick,
}: {
  incident: ZvrIncident;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Paper
      withBorder
      radius="sm"
      p="sm"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderColor: selected ? 'var(--mantine-color-blue-5)' : undefined,
        background: selected ? 'var(--mantine-color-blue-0)' : undefined,
      }}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text fw={700} size="sm" lineClamp={2}>{typeLabel(incident.type)}</Text>
          <Badge color={LEVEL_COLORS[incident.level]} variant="light" radius="sm">
            {ZVR_BEHAVIOR_LEVEL_LABELS[incident.level]}
          </Badge>
        </Group>
        <Anchor
          component={Link}
          href={`/zvr/students/${incident.student.id}`}
          size="sm"
          fw={600}
          onClick={(event) => event.stopPropagation()}
        >
          {fio(incident.student)}
        </Anchor>
        <Group gap="xs">
          <Badge color="gray" variant="outline" radius="sm">{className(incident.student)}</Badge>
          <Text size="xs" c="dimmed">{formatDate(incident.createdAt)}</Text>
        </Group>
      </Stack>
    </Paper>
  );
}

function ParticipantRow({
  student,
  label,
  color,
  supervisionCase,
  onStatusChange,
  updating,
}: {
  student: StudentBrief;
  label: string;
  color: string;
  supervisionCase?: SupervisionCase;
  onStatusChange: (caseId: string, status: SupervisionStatus) => void;
  updating: boolean;
}) {
  return (
    <Paper withBorder radius="sm" p="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <div>
            <Anchor component={Link} href={`/zvr/students/${student.id}`} fw={600} size="sm">
              {fio(student)}
            </Anchor>
            <Text size="xs" c="dimmed">{className(student)}</Text>
          </div>
          <Badge color={color} variant="light" radius="sm">
            {label}
          </Badge>
        </Group>
        {supervisionCase && (
          <Stack gap={6}>
            <Group gap="xs">
              <Badge color="blue" variant="light" radius="sm">
                Сессия {supervisionCase.sessionsDone} из {supervisionCase.sessionsPlanned}
              </Badge>
              <Badge color="gray" variant="outline" radius="sm">
                {ZVR_SUPERVISION_STATUS_LABELS[supervisionCase.status]}
              </Badge>
            </Group>
            <Select
              size="xs"
              aria-label="Статус сопровождения"
              value={supervisionCase.status}
              data={SUPERVISION_STATUSES.map((status) => ({
                value: status,
                label: ZVR_SUPERVISION_STATUS_LABELS[status],
              }))}
              disabled={updating}
              onChange={(value) => {
                if (value) onStatusChange(supervisionCase.id, value as SupervisionStatus);
              }}
            />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function ZvrIncidentsDesk() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: incidents = [], isLoading } = useQuery<ZvrIncident[]>({
    queryKey: ['zvr-incidents'],
    queryFn: async () => {
      const res = await fetch('/api/v1/zvr/incidents');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить инциденты');
      return json.data;
    },
  });

  const selected = incidents.find((incident) => incident.id === selectedId) ?? incidents[0] ?? null;

  const { data: supervisionCases = [], isFetching: supervisionLoading } = useQuery<SupervisionCase[]>({
    queryKey: ['zvr-supervision', selected?.id],
    enabled: Boolean(selected?.id),
    queryFn: async () => {
      const res = await fetch(`/api/v1/zvr/supervision?incidentId=${selected?.id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить карту сопровождения');
      return json.data;
    },
  });

  const supervisionByStudent = useMemo(() => {
    return new Map(supervisionCases.map((item) => [item.studentId, item]));
  }, [supervisionCases]);

  useEffect(() => {
    if (!selectedId && incidents[0]) setSelectedId(incidents[0].id);
    if (selectedId && incidents.length > 0 && !incidents.some((incident) => incident.id === selectedId)) {
      setSelectedId(incidents[0].id);
    }
  }, [incidents, selectedId]);

  const byStatus = useMemo(() => {
    return STATUSES.reduce<Record<IncidentStatus, ZvrIncident[]>>((acc, status) => {
      acc[status] = incidents.filter((incident) => incident.status === status);
      return acc;
    }, { pending: [], moderated: [], resolved: [] });
  }, [incidents]);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: IncidentStatus }) => {
      const res = await fetch(`/api/v1/zvr/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось обновить статус');
      return json.data as ZvrIncident;
    },
    onSuccess: (updated) => {
      setSelectedId(updated.id);
      queryClient.invalidateQueries({ queryKey: ['zvr-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['zvr-supervision', updated.id] });
      notifications.show({ color: 'green', title: 'Статус обновлён', message: ZVR_INCIDENT_STATUS_LABELS[updated.status] });
    },
    onError: (err) => {
      notifications.show({ color: 'red', title: 'Ошибка', message: err instanceof Error ? err.message : 'Не удалось обновить статус' });
    },
  });

  const supervisionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SupervisionStatus }) => {
      const res = await fetch(`/api/v1/zvr/supervision/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось обновить сопровождение');
      return json.data as SupervisionCase;
    },
    onSuccess: () => {
      if (selected?.id) queryClient.invalidateQueries({ queryKey: ['zvr-supervision', selected.id] });
      notifications.show({ color: 'green', title: 'Сопровождение обновлено', message: 'Статус сохранён' });
    },
    onError: (err) => {
      notifications.show({ color: 'red', title: 'Ошибка', message: err instanceof Error ? err.message : 'Не удалось обновить сопровождение' });
    },
  });

  const participantCount = selected ? selected.participants.length + 1 : 0;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <ThemeIcon size={40} radius="sm" color="red" variant="light">
            <IconAlertTriangle size={22} />
          </ThemeIcon>
          <div>
            <Title order={2}>Инциденты и сессии</Title>
            <Text size="sm" c="dimmed">Доска реагирования ЗВР</Text>
          </div>
        </Group>
        <Badge color="gray" variant="light" radius="sm">{incidents.length} всего</Badge>
      </Group>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Grid gutter="sm">
            {STATUSES.map((status) => (
              <Grid.Col key={status} span={{ base: 12, md: 4 }}>
                <Paper withBorder radius="sm" p="sm" h="calc(100vh - 210px)" mih={420}>
                  <Group justify="space-between" mb="sm">
                    <Text fw={700}>{ZVR_INCIDENT_STATUS_LABELS[status]}</Text>
                    <Badge color="gray" variant="light" radius="sm">{byStatus[status].length}</Badge>
                  </Group>
                  <ScrollArea h="calc(100% - 36px)" type="auto" offsetScrollbars>
                    <Stack gap="sm" pr="xs">
                      {byStatus[status].map((incident) => (
                        <IncidentCard
                          key={incident.id}
                          incident={incident}
                          selected={selected?.id === incident.id}
                          onClick={() => setSelectedId(incident.id)}
                        />
                      ))}
                      {!isLoading && byStatus[status].length === 0 && (
                        <Text c="dimmed" size="sm" ta="center" py="lg">Нет инцидентов</Text>
                      )}
                    </Stack>
                  </ScrollArea>
                </Paper>
              </Grid.Col>
            ))}
          </Grid>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper withBorder radius="sm" p="md" h="calc(100vh - 210px)" mih={420}>
            {isLoading ? (
              <Group justify="center" h="100%"><Loader /></Group>
            ) : !selected ? (
              <Stack align="center" justify="center" h="100%">
                <IconUsers size={28} color="var(--mantine-color-gray-5)" />
                <Text c="dimmed">Выберите инцидент</Text>
              </Stack>
            ) : (
              <Stack gap="md" h="100%">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text size="xs" c="dimmed">Инцидент</Text>
                    <Title order={3}>{typeLabel(selected.type)}</Title>
                  </div>
                  <Badge color={LEVEL_COLORS[selected.level]} variant="light" radius="sm">
                    {ZVR_BEHAVIOR_LEVEL_LABELS[selected.level]}
                  </Badge>
                </Group>

                <Group gap="xs">
                  <Badge color="blue" variant="light" radius="sm">{ZVR_INCIDENT_STATUS_LABELS[selected.status]}</Badge>
                  <Badge color="gray" variant="outline" radius="sm">{formatDate(selected.createdAt)}</Badge>
                </Group>

                <Divider />

                <div>
                  <Text size="xs" c="dimmed" mb={4}>Описание</Text>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{selected.description}</Text>
                </div>

                <div style={{ minHeight: 0, flex: 1 }}>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Text fw={700}>Вовлечённые ученики</Text>
                      {supervisionLoading && <Loader size="xs" />}
                    </Group>
                    <Badge color="gray" variant="light" radius="sm">{participantCount}</Badge>
                  </Group>
                  <ScrollArea h="100%" type="auto" offsetScrollbars>
                    <Stack gap="sm" pr="xs">
                      <ParticipantRow
                        student={selected.student}
                        label="Главный фигурант"
                        color="gray"
                        supervisionCase={supervisionByStudent.get(selected.student.id)}
                        updating={supervisionMutation.isPending}
                        onStatusChange={(caseId, status) => supervisionMutation.mutate({ id: caseId, status })}
                      />
                      {selected.participants.map((participant) => (
                        <ParticipantRow
                          key={participant.id}
                          student={participant.student}
                          label={ZVR_INCIDENT_ROLE_LABELS[participant.role]}
                          color={ROLE_COLORS[participant.role]}
                          supervisionCase={supervisionByStudent.get(participant.student.id)}
                          updating={supervisionMutation.isPending}
                          onStatusChange={(caseId, status) => supervisionMutation.mutate({ id: caseId, status })}
                        />
                      ))}
                    </Stack>
                  </ScrollArea>
                </div>

                <Divider />

                <Group justify="flex-end">
                  {selected.status === 'pending' && (
                    <Button
                      leftSection={<IconPlayerPlay size={16} />}
                      loading={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: selected.id, status: 'moderated' })}
                    >
                      Взять в работу
                    </Button>
                  )}
                  {selected.status !== 'resolved' && (
                    <Button
                      leftSection={<IconArchive size={16} />}
                      color="gray"
                      variant="light"
                      loading={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: selected.id, status: 'resolved' })}
                    >
                      В архив
                    </Button>
                  )}
                </Group>
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

export default function ZvrIncidentsPage() {
  return (
    <RoleGate roles={[...ZVR_ROLES]}>
      <ZvrIncidentsDesk />
    </RoleGate>
  );
}
