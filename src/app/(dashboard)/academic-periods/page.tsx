'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCalendarEvent, IconPlus } from '@tabler/icons-react';

/* ── Dark theme tokens ── */
const SURFACE = 'var(--mantine-color-default)';
const SURFACE_BORDER = 'var(--mantine-color-default-border)';
const TEXT_SEC = 'var(--mantine-color-dimmed)';
const GREEN = '#40c057';

/* ── Types ── */
interface AcademicPeriod {
  id: string;
  name: string;
  type: 'trimester' | 'holiday' | 'quarantine';
  startDate: string;
  endDate: string;
  isActive: boolean;
  gradeCount: number;
}

/* ── Table styles ── */
const thStyle: React.CSSProperties = {
  color: TEXT_SEC,
  fontSize: 12,
  fontWeight: 600,
  borderBottom: `1px solid ${SURFACE_BORDER}`,
  padding: '8px 12px',
  background: 'transparent',
};

const tdStyle: React.CSSProperties = {
  color: 'var(--mantine-color-text)',
  fontSize: 13,
  borderBottom: `1px solid ${SURFACE_BORDER}`,
  padding: '8px 12px',
};

/* ── Helpers ── */
const TYPE_LABELS: Record<string, string> = {
  trimester: 'Триместр',
  holiday: 'Каникулы',
  quarantine: 'Карантин',
};

const TYPE_COLORS: Record<string, string> = {
  trimester: 'blue',
  holiday: 'orange',
  quarantine: 'red',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/* ── Component ── */
export default function AcademicPeriodsPage() {
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<string | null>('trimester');
  const [createStart, setCreateStart] = useState('');
  const [createEnd, setCreateEnd] = useState('');
  const [createActive, setCreateActive] = useState<string | null>('false');
  const [createError, setCreateError] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editPeriod, setEditPeriod] = useState<AcademicPeriod | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editActive, setEditActive] = useState<string | null>(null);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/periods');
      const data = await res.json();
      if (data.success) {
        setPeriods(data.data);
      }
    } catch {
      console.error('Failed to fetch periods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  /* ── Create ── */
  const openCreateModal = () => {
    setCreateName('');
    setCreateType('trimester');
    setCreateStart('');
    setCreateEnd('');
    setCreateActive('false');
    setCreateError('');
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!createName.trim() || !createType || !createStart || !createEnd) {
      setCreateError('Заполните все обязательные поля');
      return;
    }
    setCreateSubmitting(true);
    setCreateError('');
    try {
      const res = await fetch('/api/v1/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          type: createType,
          startDate: createStart,
          endDate: createEnd,
          isActive: createActive === 'true',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateOpen(false);
        fetchPeriods();
      } else {
        setCreateError(data.error?.message || 'Ошибка при создании');
      }
    } catch {
      setCreateError('Ошибка сети');
    } finally {
      setCreateSubmitting(false);
    }
  };

  /* ── Edit ── */
  const openEditModal = (period: AcademicPeriod) => {
    setEditPeriod(period);
    setEditName(period.name);
    setEditType(period.type);
    setEditStart(period.startDate.slice(0, 10));
    setEditEnd(period.endDate.slice(0, 10));
    setEditActive(period.isActive ? 'true' : 'false');
    setEditError('');
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editPeriod) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      const res = await fetch(`/api/v1/periods/${editPeriod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          type: editType,
          startDate: editStart,
          endDate: editEnd,
          isActive: editActive === 'true',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditOpen(false);
        fetchPeriods();
      } else {
        setEditError(data.error?.message || 'Ошибка при обновлении');
      }
    } catch {
      setEditError('Ошибка сети');
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Loader color="eruditBlue" />
      </Box>
    );
  }

  const typeOptions = [
    { value: 'trimester', label: 'Триместр' },
    { value: 'holiday', label: 'Каникулы' },
    { value: 'quarantine', label: 'Карантин' },
  ];

  const activeOptions = [
    { value: 'true', label: 'Активный' },
    { value: 'false', label: 'Неактивный' },
  ];

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Group gap={8}>
          <IconCalendarEvent size={24} color="#228be6" stroke={1.5} />
          <Title order={3} c="var(--mantine-color-text)">
            Учебные периоды
          </Title>
          <Badge variant="light" color="gray" size="lg" radius="sm">
            {periods.length}
          </Badge>
        </Group>
        <Button leftSection={<IconPlus size={16} />} size="sm" onClick={openCreateModal}>
          Добавить период
        </Button>
      </Group>

      {/* Periods Table */}
      <Paper
        style={{
          background: SURFACE,
          border: `1px solid ${SURFACE_BORDER}`,
        }}
        radius="sm"
      >
        {periods.length === 0 ? (
          <Box p="xl" style={{ textAlign: 'center' }}>
            <Text c="dimmed" size="sm">
              Учебные периоды не настроены
            </Text>
          </Box>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={thStyle}>Название</Table.Th>
                <Table.Th style={thStyle}>Тип</Table.Th>
                <Table.Th style={thStyle}>Начало</Table.Th>
                <Table.Th style={thStyle}>Конец</Table.Th>
                <Table.Th style={thStyle}>Статус</Table.Th>
                <Table.Th style={thStyle}>Оценок</Table.Th>
                <Table.Th style={thStyle}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {periods.map((period) => (
                <Table.Tr
                  key={period.id}
                  style={
                    period.isActive
                      ? { background: 'rgba(64, 192, 87, 0.06)' }
                      : undefined
                  }
                >
                  <Table.Td style={tdStyle}>
                    <Text fw={600} size="sm" c={period.isActive ? GREEN : '#c1c2c5'}>
                      {period.name}
                    </Text>
                  </Table.Td>
                  <Table.Td style={tdStyle}>
                    <Badge
                      variant="light"
                      color={TYPE_COLORS[period.type] || 'gray'}
                      size="sm"
                      radius="sm"
                    >
                      {TYPE_LABELS[period.type] || period.type}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={tdStyle}>{formatDate(period.startDate)}</Table.Td>
                  <Table.Td style={tdStyle}>{formatDate(period.endDate)}</Table.Td>
                  <Table.Td style={tdStyle}>
                    <Badge
                      variant="filled"
                      size="sm"
                      radius="sm"
                      style={
                        period.isActive
                          ? { backgroundColor: 'rgba(64,192,87,0.15)', color: GREEN }
                          : { backgroundColor: 'rgba(144,146,150,0.15)', color: TEXT_SEC }
                      }
                    >
                      {period.isActive ? 'Активный' : 'Неактивный'}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={tdStyle}>
                    <Text size="sm" c="dimmed">
                      {period.gradeCount}
                    </Text>
                  </Table.Td>
                  <Table.Td style={tdStyle}>
                    <Button
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={() => openEditModal(period)}
                    >
                      Редактировать
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Create Modal */}
      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Добавить учебный период"
        centered
        styles={{
          header: { background: SURFACE, borderBottom: `1px solid ${SURFACE_BORDER}` },
          body: { background: SURFACE },
          content: { background: SURFACE },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Название"
            placeholder="Например: 1 Триместр 2025-2026"
            value={createName}
            onChange={(e) => setCreateName(e.currentTarget.value)}
            required
          />
          <Select
            label="Тип"
            data={typeOptions}
            value={createType}
            onChange={setCreateType}
            required
          />
          <TextInput
            label="Дата начала"
            type="date"
            value={createStart}
            onChange={(e) => setCreateStart(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Дата окончания"
            type="date"
            value={createEnd}
            onChange={(e) => setCreateEnd(e.currentTarget.value)}
            required
          />
          <Select
            label="Статус"
            data={activeOptions}
            value={createActive}
            onChange={setCreateActive}
          />

          {createError && (
            <Text c="red" size="sm">
              {createError}
            </Text>
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} loading={createSubmitting}>
              Создать
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Modal */}
      <Modal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        title="Редактировать период"
        centered
        styles={{
          header: { background: SURFACE, borderBottom: `1px solid ${SURFACE_BORDER}` },
          body: { background: SURFACE },
          content: { background: SURFACE },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Название"
            value={editName}
            onChange={(e) => setEditName(e.currentTarget.value)}
            required
          />
          <Select
            label="Тип"
            data={typeOptions}
            value={editType}
            onChange={setEditType}
            required
          />
          <TextInput
            label="Дата начала"
            type="date"
            value={editStart}
            onChange={(e) => setEditStart(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Дата окончания"
            type="date"
            value={editEnd}
            onChange={(e) => setEditEnd(e.currentTarget.value)}
            required
          />
          <Select
            label="Статус"
            data={activeOptions}
            value={editActive}
            onChange={setEditActive}
          />

          {editError && (
            <Text c="red" size="sm">
              {editError}
            </Text>
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleEdit} loading={editSubmitting}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
