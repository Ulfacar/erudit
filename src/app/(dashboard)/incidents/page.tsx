'use client';

import { useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
  Collapse,
  Box,
} from '@mantine/core';
import {
  IconFlame,
  IconPlus,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
  IconPlayerPlay,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/* ── Types ── */
interface Incident {
  id: string;
  title: string;
  description: string;
  type: 'behavior' | 'health' | 'equipment' | 'safety' | 'other';
  severity: 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  authorId: string;
  classId: string | null;
  studentId: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Constants ── */
const SEVERITY_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'yellow',
  low: 'green',
};

const SEVERITY_LABELS: Record<string, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'blue',
  in_progress: 'yellow',
  resolved: 'green',
  closed: 'gray',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  resolved: 'Решён',
  closed: 'Закрыт',
};

const TYPE_COLORS: Record<string, string> = {
  behavior: 'red',
  health: 'pink',
  equipment: 'orange',
  safety: 'violet',
  other: 'gray',
};

const TYPE_LABELS: Record<string, string> = {
  behavior: 'Поведение',
  health: 'Здоровье',
  equipment: 'Оборудование',
  safety: 'Безопасность',
  other: 'Другое',
};

const TYPE_OPTIONS = [
  { value: 'behavior', label: 'Поведение' },
  { value: 'health', label: 'Здоровье' },
  { value: 'equipment', label: 'Оборудование' },
  { value: 'safety', label: 'Безопасность' },
  { value: 'other', label: 'Другое' },
];

export default function IncidentsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<string | null>('behavior');
  const [formSeverity, setFormSeverity] = useState<string | null>('medium');

  const { data, isLoading } = useQuery<{ success: boolean; data: Incident[] }>({
    queryKey: ['incidents', filterType, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/v1/incidents?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const incidents = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/v1/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      resetForm();
      setModalOpen(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/v1/incidents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/incidents/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });

  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormDescription('');
    setFormType('behavior');
    setFormSeverity('medium');
  }, []);

  const handleCreate = () => {
    if (!formTitle || !formDescription || !formType || !formSeverity) return;
    createMutation.mutate({
      title: formTitle,
      description: formDescription,
      type: formType,
      severity: formSeverity,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconFlame size={24} color="var(--mantine-color-red-6)" />
          <Title order={3}>Происшествия</Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setModalOpen(true)}
        >
          Создать происшествие
        </Button>
      </Group>

      {/* Filters */}
      <Paper withBorder p="sm">
        <Group>
          <Select
            placeholder="Тип"
            clearable
            value={filterType}
            onChange={setFilterType}
            data={TYPE_OPTIONS}
            w={180}
          />
          <Select
            placeholder="Статус"
            clearable
            value={filterStatus}
            onChange={setFilterStatus}
            data={[
              { value: 'open', label: 'Открыт' },
              { value: 'in_progress', label: 'В работе' },
              { value: 'resolved', label: 'Решён' },
              { value: 'closed', label: 'Закрыт' },
            ]}
            w={180}
          />
        </Group>
      </Paper>

      {/* Table */}
      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Название</Table.Th>
              <Table.Th>Тип</Table.Th>
              <Table.Th>Серьёзность</Table.Th>
              <Table.Th>Статус</Table.Th>
              <Table.Th>Дата</Table.Th>
              <Table.Th>Действия</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed" py="md">Загрузка...</Text>
                </Table.Td>
              </Table.Tr>
            ) : incidents.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed" py="md">Нет данных</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              incidents.map((incident) => (
                <>
                  <Table.Tr
                    key={incident.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === incident.id ? null : incident.id)}
                  >
                    <Table.Td>
                      <Group gap={4}>
                        {expandedId === incident.id ? (
                          <IconChevronUp size={14} />
                        ) : (
                          <IconChevronDown size={14} />
                        )}
                        <Text size="sm" fw={500}>{incident.title}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={TYPE_COLORS[incident.type]} variant="filled" size="sm">
                        {TYPE_LABELS[incident.type]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={SEVERITY_COLORS[incident.severity]} variant="light" size="sm">
                        {SEVERITY_LABELS[incident.severity]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_COLORS[incident.status]} variant="light" size="sm">
                        {STATUS_LABELS[incident.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{formatDate(incident.createdAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} onClick={(e) => e.stopPropagation()}>
                        {incident.status === 'open' && (
                          <Tooltip label="Взять в работу">
                            <ActionIcon
                              variant="light"
                              color="yellow"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: incident.id, status: 'in_progress' })}
                            >
                              <IconPlayerPlay size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {incident.status === 'in_progress' && (
                          <Tooltip label="Решить">
                            <ActionIcon
                              variant="light"
                              color="green"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: incident.id, status: 'resolved' })}
                            >
                              <IconCheck size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {incident.status === 'resolved' && (
                          <Tooltip label="Закрыть">
                            <ActionIcon
                              variant="light"
                              color="gray"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: incident.id, status: 'closed' })}
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label="Удалить">
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="sm"
                            onClick={() => {
                              if (window.confirm('Удалить инцидент? Действие нельзя отменить.')) {
                                deleteMutation.mutate(incident.id);
                              }
                            }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                  {expandedId === incident.id && (
                    <Table.Tr key={`${incident.id}-detail`}>
                      <Table.Td colSpan={6}>
                        <Box p="sm" bg="var(--mantine-color-gray-light)">
                          <Text size="sm" fw={600} mb={4}>Описание:</Text>
                          <Text size="sm" mb="xs">{incident.description}</Text>
                          {incident.resolvedAt && (
                            <Text size="xs" c="dimmed">
                              Решено: {formatDate(incident.resolvedAt)}
                            </Text>
                          )}
                        </Box>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Create Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title="Создать происшествие"
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="Название"
            placeholder="Введите название"
            value={formTitle}
            onChange={(e) => setFormTitle(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Описание"
            placeholder="Опишите происшествие"
            value={formDescription}
            onChange={(e) => setFormDescription(e.currentTarget.value)}
            minRows={3}
            required
          />
          <Select
            label="Тип"
            value={formType}
            onChange={setFormType}
            data={TYPE_OPTIONS}
            required
          />
          <Select
            label="Серьёзность"
            value={formSeverity}
            onChange={setFormSeverity}
            data={[
              { value: 'high', label: 'Высокая' },
              { value: 'medium', label: 'Средняя' },
              { value: 'low', label: 'Низкая' },
            ]}
            required
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => { setModalOpen(false); resetForm(); }}>
              Отмена
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!formTitle || !formDescription || !formType || !formSeverity}
            >
              Создать
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
