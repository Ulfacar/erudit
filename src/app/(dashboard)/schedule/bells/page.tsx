'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCheck, IconClock, IconEdit, IconX } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

/* ── Dark theme tokens ── */
const SURFACE = '#ffffff';
const SURFACE_BORDER = '#e6e9ee';
const TEXT_SEC = 'var(--mantine-color-dimmed)';

/* ── Types ── */
interface BellSlot {
  id: string;
  slotNumber: number;
  startTime: string;
  endTime: string;
  type: 'lesson' | 'break_time' | 'breakfast' | 'lunch' | 'snack' | 'dismissal';
}

const SLOT_TYPE_OPTIONS = [
  { value: 'lesson', label: 'Урок' },
  { value: 'break_time', label: 'Перемена' },
  { value: 'breakfast', label: 'Завтрак' },
  { value: 'lunch', label: 'Обед' },
  { value: 'snack', label: 'Полдник' },
  { value: 'dismissal', label: 'Уход' },
];

const SLOT_TYPE_COLORS: Record<string, string> = {
  lesson: 'blue',
  break_time: 'gray',
  breakfast: 'orange',
  lunch: 'yellow',
  snack: 'teal',
  dismissal: 'red',
};

const SLOT_TYPE_LABELS: Record<string, string> = {
  lesson: 'Урок',
  break_time: 'Перемена',
  breakfast: 'Завтрак',
  lunch: 'Обед',
  snack: 'Полдник',
  dismissal: 'Уход',
};

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

/* ── Component ── */
function BellScheduleContent() {
  const [loading, setLoading] = useState(true);
  const [bells, setBells] = useState<BellSlot[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editType, setEditType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchBells = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/schedule/bells');
      const data = await res.json();
      if (data.success) setBells(data.data);
    } catch {
      console.error('Failed to fetch bell schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBells();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(slot: BellSlot) {
    setEditingId(slot.id);
    setEditStart(slot.startTime);
    setEditEnd(slot.endTime);
    setEditType(slot.type);
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setError('');
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/v1/schedule/bells', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          startTime: editStart,
          endTime: editEnd,
          type: editType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingId(null);
        fetchBells();
      } else {
        setError(data.error?.message || 'Ошибка при сохранении');
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Loader color="blue" />
      </Box>
    );
  }

  // Compute total school day duration
  const firstSlot = bells[0];
  const lastSlot = bells[bells.length - 1];
  const lessonCount = bells.filter((b) => b.type === 'lesson').length;

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Group gap={8}>
          <IconClock size={24} color="#228be6" stroke={1.5} />
          <Title order={3} c="var(--mantine-color-text)">
            Расписание звонков
          </Title>
          <Badge variant="light" color="gray" size="lg" radius="sm">
            {bells.length} слотов
          </Badge>
        </Group>
      </Group>

      {/* Summary */}
      {firstSlot && lastSlot && (
        <Group gap="md">
          <Badge variant="light" color="blue" size="sm" radius="sm">
            {firstSlot.startTime} - {lastSlot.endTime}
          </Badge>
          <Text size="sm" c={TEXT_SEC}>
            {lessonCount} уроков
          </Text>
        </Group>
      )}

      {/* Table */}
      <Paper
        style={{
          background: SURFACE,
          border: `1px solid ${SURFACE_BORDER}`,
        }}
        radius="sm"
      >
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={thStyle}>#</Table.Th>
              <Table.Th style={thStyle}>Тип</Table.Th>
              <Table.Th style={thStyle}>Начало</Table.Th>
              <Table.Th style={thStyle}>Конец</Table.Th>
              <Table.Th style={thStyle}>Длительность</Table.Th>
              <Table.Th style={thStyle}>Действия</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {bells.map((slot) => {
              const isEditing = editingId === slot.id;

              // Calculate duration
              const [sh, sm] = slot.startTime.split(':').map(Number);
              const [eh, em] = slot.endTime.split(':').map(Number);
              const durationMin = (eh * 60 + em) - (sh * 60 + sm);

              return (
                <Table.Tr
                  key={slot.id}
                  style={{
                    background: isEditing ? 'rgba(34, 139, 230, 0.05)' : undefined,
                  }}
                >
                  <Table.Td style={tdStyle}>
                    <Text fw={600} size="sm" c="var(--mantine-color-text)">
                      {slot.slotNumber}
                    </Text>
                  </Table.Td>

                  <Table.Td style={tdStyle}>
                    {isEditing ? (
                      <Select
                        data={SLOT_TYPE_OPTIONS}
                        value={editType}
                        onChange={setEditType}
                        size="xs"
                        style={{ width: 140 }}
                      />
                    ) : (
                      <Badge
                        variant="light"
                        color={SLOT_TYPE_COLORS[slot.type] || 'gray'}
                        size="sm"
                        radius="sm"
                      >
                        {SLOT_TYPE_LABELS[slot.type] || slot.type}
                      </Badge>
                    )}
                  </Table.Td>

                  <Table.Td style={tdStyle}>
                    {isEditing ? (
                      <TextInput
                        value={editStart}
                        onChange={(e) => setEditStart(e.currentTarget.value)}
                        size="xs"
                        style={{ width: 90 }}
                        placeholder="08:30"
                      />
                    ) : (
                      <Text size="sm" c="var(--mantine-color-text)">{slot.startTime}</Text>
                    )}
                  </Table.Td>

                  <Table.Td style={tdStyle}>
                    {isEditing ? (
                      <TextInput
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.currentTarget.value)}
                        size="xs"
                        style={{ width: 90 }}
                        placeholder="09:15"
                      />
                    ) : (
                      <Text size="sm" c="var(--mantine-color-text)">{slot.endTime}</Text>
                    )}
                  </Table.Td>

                  <Table.Td style={tdStyle}>
                    <Text size="sm" c={TEXT_SEC}>
                      {durationMin > 0 ? `${durationMin} мин` : '---'}
                    </Text>
                  </Table.Td>

                  <Table.Td style={tdStyle}>
                    {isEditing ? (
                      <Group gap={4}>
                        <Button
                          variant="subtle"
                          color="green"
                          size="xs"
                          onClick={() => saveEdit(slot.id)}
                          loading={saving}
                          leftSection={<IconCheck size={14} />}
                        >
                          Сохранить
                        </Button>
                        <Button
                          variant="subtle"
                          color="gray"
                          size="xs"
                          onClick={cancelEdit}
                          leftSection={<IconX size={14} />}
                        >
                          Отмена
                        </Button>
                      </Group>
                    ) : (
                      <Button
                        variant="subtle"
                        color="blue"
                        size="xs"
                        onClick={() => startEdit(slot)}
                        leftSection={<IconEdit size={14} />}
                      >
                        Изменить
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        {error && (
          <Box p="sm">
            <Text c="red" size="sm">{error}</Text>
          </Box>
        )}
      </Paper>

      {/* Structure overview */}
      <Paper
        style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}` }}
        p="md"
        radius="sm"
      >
        <Text size="sm" fw={600} c="var(--mantine-color-text)" mb="xs">
          Структура дня
        </Text>
        <Group gap={6} style={{ flexWrap: 'wrap' }}>
          {bells.map((slot) => (
            <Badge
              key={slot.id}
              variant="dot"
              color={SLOT_TYPE_COLORS[slot.type] || 'gray'}
              size="sm"
            >
              {slot.startTime} {SLOT_TYPE_LABELS[slot.type]}{slot.type === 'lesson' ? ` ${slot.slotNumber}` : ''}
            </Badge>
          ))}
        </Group>
      </Paper>
    </Stack>
  );
}

export default function BellSchedulePage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator']}>
      <BellScheduleContent />
    </RoleGate>
  );
}
