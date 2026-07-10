'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Group, Loader, Modal, Paper, ScrollArea, Select, Stack, Table, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPalette, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['club_coach', 'super_admin', 'zavuch'] as const;
const STATUSES = [
  { value: 'active', label: 'Активен' },
  { value: 'archived', label: 'Архив' },
];
const STATUS_COLOR: Record<string, string> = { active: 'green', archived: 'gray' };

type ClubRow = {
  id: string;
  name: string;
  subjectId?: string | null;
  status?: string | null;
  _count: { sessions: number; participants: number };
};
type Option = { value: string; label: string };

function statusLabel(value?: string | null) {
  return STATUSES.find((status) => status.value === value)?.label ?? value ?? 'Активен';
}

function CreateClubModal({ opened, onClose, subjects }: { opened: boolean; onClose: () => void; subjects: Option[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Укажите название');
      const res = await fetch('/api/v1/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), subjectId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось создать кружок');
      return json.data as { id: string };
    },
    onSuccess: (created) => {
      notifications.show({ color: 'green', title: 'Готово', message: 'Кружок создан' });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      setName('');
      setSubjectId(null);
      onClose();
      router.push(`/clubs/${created.id}`);
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось создать кружок' }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Новый кружок" size="md">
      <Stack gap="sm">
        <TextInput label="Название" value={name} onChange={(event) => setName(event.currentTarget.value)} required />
        <Select label="Предмет" data={subjects} value={subjectId} onChange={setSubjectId} searchable clearable />
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>Создать</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ClubsPageContent() {
  const router = useRouter();
  const [opened, setOpened] = useState(false);

  const clubsQuery = useQuery<ClubRow[]>({
    queryKey: ['clubs'],
    queryFn: async () => {
      const res = await fetch('/api/v1/clubs');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить кружки');
      return json.data;
    },
  });
  const subjectsQuery = useQuery<Option[]>({
    queryKey: ['club-subject-options'],
    queryFn: async () => {
      const res = await fetch('/api/v1/grading/subjects');
      const json = await res.json();
      return json.success ? json.data.map((row: { id: string; name: string }) => ({ value: row.id, label: row.name })) : [];
    },
  });
  const subjectMap = new Map((subjectsQuery.data ?? []).map((subject) => [subject.value, subject.label]));

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <ThemeIcon size={40} radius="sm" color="grape" variant="light"><IconPalette size={22} /></ThemeIcon>
          <div>
            <Title order={2}>Кружки</Title>
            <Text size="sm" c="dimmed">Дополнительные секции, участники и журнал посещаемости</Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>Кружок</Button>
      </Group>

      <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
        {clubsQuery.isLoading ? (
          <Group justify="center" py="xl"><Loader /></Group>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="sm" miw={760}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Название</Table.Th>
                  <Table.Th>Предмет</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Занятия</Table.Th>
                  <Table.Th>Участники</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(clubsQuery.data ?? []).map((club) => (
                  <Table.Tr key={club.id} onClick={() => router.push(`/clubs/${club.id}`)} style={{ cursor: 'pointer' }}>
                    <Table.Td><Text fw={600}>{club.name}</Text></Table.Td>
                    <Table.Td>{club.subjectId ? subjectMap.get(club.subjectId) ?? '—' : '—'}</Table.Td>
                    <Table.Td><Badge variant="light" color={STATUS_COLOR[club.status ?? 'active'] ?? 'gray'} radius="sm">{statusLabel(club.status)}</Badge></Table.Td>
                    <Table.Td>{club._count.sessions}</Table.Td>
                    <Table.Td>{club._count.participants}</Table.Td>
                  </Table.Tr>
                ))}
                {(clubsQuery.data ?? []).length === 0 && (
                  <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="lg">Кружки ещё не созданы</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      <CreateClubModal opened={opened} onClose={() => setOpened(false)} subjects={subjectsQuery.data ?? []} />
    </Stack>
  );
}

export default function ClubsPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <ClubsPageContent />
    </RoleGate>
  );
}
