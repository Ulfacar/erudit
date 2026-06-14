'use client';

import { Fragment, useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
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
  IconAlertTriangle,
  IconPlus,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
  IconPlayerPlay,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';

/* ── Types ── */
interface UrgentIssue {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  authorId: string;
  visibleTo: string[];
  classId: string | null;
  studentId: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Constants ── */
const PRIORITY_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'yellow',
  low: 'green',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
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

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Администратор' },
  { value: 'zavuch', label: 'Завуч' },
  { value: 'curator', label: 'Куратор' },
  { value: 'teacher', label: 'Учитель' },
  { value: 'secretary', label: 'Секретарь' },
  { value: 'analyst', label: 'Аналитик' },
  { value: 'specialist', label: 'Специалист' },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Админ',
  zavuch: 'Завуч',
  curator: 'Куратор',
  teacher: 'Учитель',
  secretary: 'Секретарь',
  analyst: 'Аналитик',
  specialist: 'Специалист',
};

function UrgentIssuesContent() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<string | null>('medium');
  const [formVisibleTo, setFormVisibleTo] = useState<string[]>([]);

  const { data, isLoading } = useQuery<{ success: boolean; data: UrgentIssue[] }>({
    queryKey: ['urgent-issues', filterStatus, filterPriority],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      const res = await fetch(`/api/v1/urgent-issues?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const issues = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/v1/urgent-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['urgent-issues'] });
      resetForm();
      setModalOpen(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/v1/urgent-issues/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['urgent-issues'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/urgent-issues/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['urgent-issues'] });
    },
  });

  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormVisibleTo([]);
  }, []);

  const handleCreate = () => {
    if (!formTitle || !formDescription || !formPriority) return;
    createMutation.mutate({
      title: formTitle,
      description: formDescription,
      priority: formPriority,
      visibleTo: formVisibleTo,
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
          <IconAlertTriangle size={24} color="var(--mantine-color-red-6)" />
          <Title order={3}>Срочные вопросы</Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setModalOpen(true)}
        >
          Создать вопрос
        </Button>
      </Group>

      {/* Filters */}
      <Paper withBorder p="sm">
        <Group>
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
          <Select
            placeholder="Приоритет"
            clearable
            value={filterPriority}
            onChange={setFilterPriority}
            data={[
              { value: 'high', label: 'Высокий' },
              { value: 'medium', label: 'Средний' },
              { value: 'low', label: 'Низкий' },
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
              <Table.Th>Тема</Table.Th>
              <Table.Th>Приоритет</Table.Th>
              <Table.Th>Кому видно</Table.Th>
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
            ) : issues.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed" py="md">Нет данных</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              issues.map((issue) => (
                <Fragment key={issue.id}>
                  <Table.Tr
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                  >
                    <Table.Td>
                      <Group gap={4}>
                        {expandedId === issue.id ? (
                          <IconChevronUp size={14} />
                        ) : (
                          <IconChevronDown size={14} />
                        )}
                        <Text size="sm" fw={500}>{issue.title}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={PRIORITY_COLORS[issue.priority]} variant="filled" size="sm">
                        {PRIORITY_LABELS[issue.priority]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {issue.visibleTo.map((role) => (
                          <Badge key={role} variant="light" size="xs">
                            {ROLE_LABELS[role] || role}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_COLORS[issue.status]} variant="light" size="sm">
                        {STATUS_LABELS[issue.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{formatDate(issue.createdAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} onClick={(e) => e.stopPropagation()}>
                        {issue.status === 'open' && (
                          <Tooltip label="Взять в работу">
                            <ActionIcon
                              variant="light"
                              color="yellow"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: issue.id, status: 'in_progress' })}
                            >
                              <IconPlayerPlay size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {issue.status === 'in_progress' && (
                          <Tooltip label="Решить">
                            <ActionIcon
                              variant="light"
                              color="green"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: issue.id, status: 'resolved' })}
                            >
                              <IconCheck size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {issue.status === 'resolved' && (
                          <Tooltip label="Закрыть">
                            <ActionIcon
                              variant="light"
                              color="gray"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: issue.id, status: 'closed' })}
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
                              if (window.confirm('Удалить срочный вопрос? Действие нельзя отменить.')) {
                                deleteMutation.mutate(issue.id);
                              }
                            }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                  {expandedId === issue.id && (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Box p="sm" bg="var(--mantine-color-gray-light)">
                          <Text size="sm" fw={600} mb={4}>Описание:</Text>
                          <Text size="sm" mb="xs">{issue.description}</Text>
                          {issue.resolvedAt && (
                            <Text size="xs" c="dimmed">
                              Решено: {formatDate(issue.resolvedAt)}
                            </Text>
                          )}
                        </Box>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Fragment>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Create Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title="Создать срочный вопрос"
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="Тема"
            placeholder="Введите тему"
            value={formTitle}
            onChange={(e) => setFormTitle(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Описание"
            placeholder="Опишите проблему"
            value={formDescription}
            onChange={(e) => setFormDescription(e.currentTarget.value)}
            minRows={3}
            required
          />
          <Select
            label="Приоритет"
            value={formPriority}
            onChange={setFormPriority}
            data={[
              { value: 'high', label: 'Высокий' },
              { value: 'medium', label: 'Средний' },
              { value: 'low', label: 'Низкий' },
            ]}
            required
          />
          <MultiSelect
            label="Кому показать"
            placeholder="Выберите роли"
            value={formVisibleTo}
            onChange={setFormVisibleTo}
            data={ROLE_OPTIONS}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => { setModalOpen(false); resetForm(); }}>
              Отмена
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!formTitle || !formDescription || !formPriority}
            >
              Создать
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function UrgentIssuesPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'teacher', 'curator', 'specialist', 'psychologist']}>
      <UrgentIssuesContent />
    </RoleGate>
  );
}
