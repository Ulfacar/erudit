'use client';

import Link from 'next/link';
import type { Role } from '@prisma/client';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconUsersGroup } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ZVR_MEDIATION_PARTY_LABELS } from '@/modules/zvr/labels';

const ZVR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const satisfies readonly Role[];

type StudentBrief = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  class?: { grade: number; letter: string } | null;
};

type Protocol = {
  id: string;
  studentId: string;
  date: string;
  agreement: string;
  student: StudentBrief & { fio?: string };
  obligations: { id: string; done: boolean }[];
};

type Incident = {
  id: string;
  studentId: string;
  type: string;
  createdAt: string;
  student: StudentBrief;
};

type ObligationDraft = { party: 'student' | 'parent'; task: string; deadline: string };

function fio(student: StudentBrief) {
  return [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
}

function className(student?: StudentBrief | null) {
  return student?.class ? `${student.class.grade}${student.class.letter}` : 'Без класса';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function shortText(value: string, length = 120) {
  return value.length > length ? `${value.slice(0, length).trim()}...` : value;
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function CreateMediationModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [date, setDate] = useState(() => localDateInputValue());
  const [agreement, setAgreement] = useState('');
  const [obligations, setObligations] = useState<ObligationDraft[]>([
    { party: 'student', task: '', deadline: '' },
    { party: 'parent', task: '', deadline: '' },
  ]);

  const { data: students = [], isLoading: studentsLoading } = useQuery<StudentBrief[]>({
    queryKey: ['zvr-family-students'],
    queryFn: async () => {
      const res = await fetch('/api/v1/students');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить учеников');
      return json.data;
    },
  });

  const { data: incidents = [] } = useQuery<Incident[]>({
    queryKey: ['zvr-family-incidents'],
    queryFn: async () => {
      const res = await fetch('/api/v1/zvr/incidents');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить инциденты');
      return json.data;
    },
  });

  const studentOptions = useMemo(() => students.map((student) => ({
    value: student.id,
    label: `${fio(student)} (${className(student)})`,
  })), [students]);

  const incidentOptions = useMemo(() => incidents
    .filter((incident) => !studentId || incident.studentId === studentId)
    .map((incident) => ({
      value: incident.id,
      label: `${formatDate(incident.createdAt)} · ${incident.type} · ${fio(incident.student)}`,
    })), [incidents, studentId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        studentId,
        behaviorIncidentId: incidentId || undefined,
        date,
        agreement,
        obligations: obligations
          .filter((item) => item.task.trim())
          .map((item) => ({ party: item.party, task: item.task.trim(), deadline: item.deadline || undefined })),
      };
      const res = await fetch('/api/v1/zvr/mediation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось создать протокол');
      return json.data as Protocol;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zvr-mediation'] });
      notifications.show({ color: 'green', title: 'Протокол создан', message: 'Медиация и обязательства сохранены' });
      setStudentId(null);
      setIncidentId(null);
      setAgreement('');
      setObligations([{ party: 'student', task: '', deadline: '' }, { party: 'parent', task: '', deadline: '' }]);
      onClose();
    },
    onError: (err) => {
      notifications.show({ color: 'red', title: 'Ошибка', message: err instanceof Error ? err.message : 'Не удалось создать протокол' });
    },
  });

  function updateObligation(index: number, patch: Partial<ObligationDraft>) {
    setObligations((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Провести медиацию" size="lg" centered>
      <Stack gap="sm">
        <Select
          label="Ученик"
          placeholder="Найдите ученика"
          searchable
          clearable
          data={studentOptions}
          value={studentId}
          disabled={studentsLoading}
          onChange={(value) => {
            setStudentId(value);
            setIncidentId(null);
          }}
        />
        <Select
          label="Инцидент"
          placeholder="Можно оставить пустым"
          searchable
          clearable
          data={incidentOptions}
          value={incidentId}
          onChange={setIncidentId}
        />
        <TextInput label="Дата" type="date" value={date} onChange={(event) => setDate(event.currentTarget.value)} />
        <Textarea label="Соглашение" required autosize minRows={4} value={agreement} onChange={(event) => setAgreement(event.currentTarget.value)} />

        <Group justify="space-between">
          <Text fw={700}>Обязательства</Text>
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setObligations((items) => [...items, { party: 'student', task: '', deadline: '' }])}>
            Добавить
          </Button>
        </Group>

        <Stack gap="xs">
          {obligations.map((item, index) => (
            <Group key={index} align="flex-end" wrap="nowrap">
              <Select
                w={145}
                label={index === 0 ? 'Сторона' : undefined}
                data={[
                  { value: 'student', label: ZVR_MEDIATION_PARTY_LABELS.student },
                  { value: 'parent', label: ZVR_MEDIATION_PARTY_LABELS.parent },
                ]}
                value={item.party}
                onChange={(value) => updateObligation(index, { party: (value ?? 'student') as ObligationDraft['party'] })}
              />
              <TextInput
                style={{ flex: 1 }}
                label={index === 0 ? 'Задача' : undefined}
                value={item.task}
                onChange={(event) => updateObligation(index, { task: event.currentTarget.value })}
              />
              <TextInput
                w={150}
                label={index === 0 ? 'Дедлайн' : undefined}
                type="date"
                value={item.deadline}
                onChange={(event) => updateObligation(index, { deadline: event.currentTarget.value })}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label="Удалить обязательство"
                onClick={() => setObligations((items) => items.filter((_, i) => i !== index))}
                disabled={obligations.length === 1}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>

        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Сохранить протокол</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function FamilyWorkDesk() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: protocols = [], isLoading } = useQuery<Protocol[]>({
    queryKey: ['zvr-mediation'],
    queryFn: async () => {
      const res = await fetch('/api/v1/zvr/mediation');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить протоколы медиации');
      return json.data;
    },
  });

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <ThemeIcon size={40} radius="sm" color="teal" variant="light">
            <IconUsersGroup size={22} />
          </ThemeIcon>
          <div>
            <Title order={2}>Работа с семьёй</Title>
            <Text size="sm" c="dimmed">Медиации и семейные коммуникации</Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>Провести медиацию</Button>
      </Group>

      <Paper withBorder radius="sm">
        {isLoading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : protocols.length === 0 ? (
          <Text c="dimmed" p="md">Протоколов медиации пока нет.</Text>
        ) : (
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Дата</Table.Th>
                <Table.Th>Ученик</Table.Th>
                <Table.Th>Соглашение</Table.Th>
                <Table.Th>Обязательства</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {protocols.map((protocol) => {
                const done = protocol.obligations.filter((item) => item.done).length;
                const total = protocol.obligations.length;
                return (
                  <Table.Tr key={protocol.id}>
                    <Table.Td>{formatDate(protocol.date)}</Table.Td>
                    <Table.Td>
                      <Anchor component={Link} href={`/zvr/students/${protocol.studentId}`} fw={600}>
                        {protocol.student.fio ?? fio(protocol.student)}
                      </Anchor>
                      <Text size="xs" c="dimmed">{className(protocol.student)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={2}>{shortText(protocol.agreement)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={done === total && total > 0 ? 'green' : 'blue'} variant="light" radius="sm">
                        {done}/{total}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <CreateMediationModal opened={modalOpen} onClose={() => setModalOpen(false)} />
    </Stack>
  );
}

export default function ZvrFamilyPage() {
  return (
    <RoleGate roles={[...ZVR_ROLES]}>
      <FamilyWorkDesk />
    </RoleGate>
  );
}
