'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconClock, IconUser } from '@tabler/icons-react';

/* ── Dark theme tokens ── */
const SURFACE = 'var(--mantine-color-default)';
const SURFACE_BORDER = 'var(--mantine-color-default-border)';
const TEXT_SEC = 'var(--mantine-color-dimmed)';

/* ── Types ── */
interface BellSlot {
  id: string;
  slotNumber: number;
  startTime: string;
  endTime: string;
  type: 'lesson' | 'break_time' | 'breakfast' | 'lunch' | 'snack' | 'dismissal';
}

interface TeacherOption {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
}

interface ScheduleEntry {
  id: string;
  classId: string;
  teacherId: string;
  subjectId: string;
  slotId: string;
  dayOfWeek: number;
  periodStart: string;
  periodEnd: string;
  class: { id: string; grade: number; letter: string };
  teacher: TeacherOption;
  subject: { id: string; name: string; color?: string | null };
  slot: BellSlot;
}

/* ── Constants ── */
const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
const DAY_NUMBERS = [1, 2, 3, 4, 5];

const SLOT_TYPE_LABELS: Record<string, string> = {
  lesson: 'Урок',
  break_time: 'Перемена',
  breakfast: 'Завтрак',
  lunch: 'Обед',
  snack: 'Полдник',
  dismissal: 'Уход',
};

/* ── Component ── */
export default function TeacherSchedulePage() {
  const [loading, setLoading] = useState(true);
  const [bells, setBells] = useState<BellSlot[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);

  const periodStart = '2025-09-01';
  const periodEnd = '2026-06-30';

  const fetchInitial = useCallback(async () => {
    try {
      const [bellsRes, teachersRes] = await Promise.all([
        fetch('/api/v1/schedule/bells'),
        fetch('/api/v1/teachers'),
      ]);
      const bellsData = await bellsRes.json();
      const teachersData = await teachersRes.json();

      if (bellsData.success) setBells(bellsData.data);
      if (teachersData.success) {
        const list = teachersData.data.map((t: TeacherOption & { id: string }) => ({
          id: t.id,
          firstName: t.firstName,
          lastName: t.lastName,
          middleName: t.middleName,
        }));
        setTeachers(list);
      }
    } catch {
      console.error('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!selectedTeacherId) {
      setEntries([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/v1/schedule?teacherId=${selectedTeacherId}&periodStart=${periodStart}&periodEnd=${periodEnd}`,
      );
      const data = await res.json();
      if (data.success) setEntries(data.data);
    } catch {
      console.error('Failed to fetch teacher entries');
    }
  }, [selectedTeacherId, periodStart, periodEnd]);

  useEffect(() => {
    fetchInitial();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchEntries();
  }, [selectedTeacherId, fetchEntries]);

  function getEntry(slotId: string, day: number): ScheduleEntry | undefined {
    return entries.find((e) => e.slotId === slotId && e.dayOfWeek === day);
  }

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  if (loading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Loader color="blue" />
      </Box>
    );
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Group gap={8}>
        <IconUser size={24} color="#228be6" stroke={1.5} />
        <Title order={3} c="var(--mantine-color-text)">
          Расписание педагога
        </Title>
      </Group>

      {/* Teacher selector */}
      <Select
        placeholder="Выберите педагога"
        data={teachers.map((t) => ({
          value: t.id,
          label: `${t.lastName} ${t.firstName}${t.middleName ? ` ${t.middleName}` : ''}`,
        }))}
        value={selectedTeacherId}
        onChange={setSelectedTeacherId}
        searchable
        clearable
        styles={{
          input: {
            backgroundColor: SURFACE,
            borderColor: SURFACE_BORDER,
            color: 'var(--mantine-color-text)',
          },
        }}
        style={{ maxWidth: 400 }}
      />

      {/* Teacher info badge */}
      {selectedTeacher && (
        <Group gap={8}>
          <Badge variant="light" color="blue" size="lg" radius="sm">
            {selectedTeacher.lastName} {selectedTeacher.firstName}
          </Badge>
          <Text size="sm" c={TEXT_SEC}>
            Уроков на неделе: {entries.length}
          </Text>
        </Group>
      )}

      {/* Schedule grid */}
      {selectedTeacherId ? (
        <Paper
          style={{
            background: SURFACE,
            border: `1px solid ${SURFACE_BORDER}`,
            overflow: 'hidden',
          }}
          radius="sm"
        >
          <ScrollArea>
            <Table
              style={{ minWidth: 900 }}
              styles={{
                table: { borderCollapse: 'collapse' },
              }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th
                    style={{
                      color: TEXT_SEC,
                      fontSize: 12,
                      fontWeight: 600,
                      borderBottom: `1px solid ${SURFACE_BORDER}`,
                      borderRight: `1px solid ${SURFACE_BORDER}`,
                      padding: '8px 12px',
                      background: 'transparent',
                      width: 120,
                      minWidth: 120,
                    }}
                  >
                    <Group gap={4}>
                      <IconClock size={14} />
                      <span>Время / Урок</span>
                    </Group>
                  </Table.Th>
                  {DAY_NAMES.map((name, i) => (
                    <Table.Th
                      key={i}
                      style={{
                        color: TEXT_SEC,
                        fontSize: 12,
                        fontWeight: 600,
                        borderBottom: `1px solid ${SURFACE_BORDER}`,
                        borderRight: i < 4 ? `1px solid ${SURFACE_BORDER}` : undefined,
                        padding: '8px 12px',
                        background: 'transparent',
                        textAlign: 'center',
                        minWidth: 150,
                      }}
                    >
                      {name}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {bells.map((slot) => {
                  const isNonLesson = slot.type !== 'lesson' && slot.type !== 'break_time';
                  const isBreak = slot.type === 'break_time';

                  return (
                    <Table.Tr key={slot.id}>
                      {/* Time cell */}
                      <Table.Td
                        style={{
                          borderBottom: `1px solid ${SURFACE_BORDER}`,
                          borderRight: `1px solid ${SURFACE_BORDER}`,
                          padding: '6px 10px',
                          background: isNonLesson
                            ? 'rgba(134, 142, 150, 0.05)'
                            : isBreak
                              ? 'rgba(134, 142, 150, 0.03)'
                              : 'transparent',
                          verticalAlign: 'middle',
                        }}
                      >
                        <Text size="xs" c="var(--mantine-color-text)" fw={600}>
                          {slot.startTime} - {slot.endTime}
                        </Text>
                        <Text size="xs" c={TEXT_SEC}>
                          {slot.type === 'lesson'
                            ? `${slot.slotNumber} урок`
                            : SLOT_TYPE_LABELS[slot.type] || slot.type}
                        </Text>
                      </Table.Td>

                      {/* Day cells */}
                      {DAY_NUMBERS.map((day, dayIdx) => {
                        const entry = slot.type === 'lesson' ? getEntry(slot.id, day) : undefined;

                        if (isNonLesson) {
                          return (
                            <Table.Td
                              key={day}
                              style={{
                                borderBottom: `1px solid ${SURFACE_BORDER}`,
                                borderRight: dayIdx < 4 ? `1px solid ${SURFACE_BORDER}` : undefined,
                                padding: '6px 10px',
                                background: 'rgba(134, 142, 150, 0.08)',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                              }}
                            >
                              <Text size="xs" c={TEXT_SEC} fs="italic">
                                {SLOT_TYPE_LABELS[slot.type]}
                              </Text>
                            </Table.Td>
                          );
                        }

                        if (isBreak) {
                          return (
                            <Table.Td
                              key={day}
                              style={{
                                borderBottom: `1px solid ${SURFACE_BORDER}`,
                                borderRight: dayIdx < 4 ? `1px solid ${SURFACE_BORDER}` : undefined,
                                padding: '4px 10px',
                                background: 'rgba(134, 142, 150, 0.05)',
                                height: 28,
                              }}
                            />
                          );
                        }

                        if (entry) {
                          return (
                            <Table.Td
                              key={day}
                              style={{
                                borderBottom: `1px solid ${SURFACE_BORDER}`,
                                borderRight: dayIdx < 4 ? `1px solid ${SURFACE_BORDER}` : undefined,
                                padding: '6px 10px',
                                background: 'rgba(34, 139, 230, 0.08)',
                                verticalAlign: 'middle',
                              }}
                            >
                              <Text size="xs" fw={600} c="var(--mantine-color-text)" lineClamp={1}>
                                {entry.subject.name}
                              </Text>
                              <Text size="xs" c={TEXT_SEC} lineClamp={1}>
                                {entry.class.grade}{entry.class.letter}
                              </Text>
                            </Table.Td>
                          );
                        }

                        // Free slot - highlighted subtly
                        return (
                          <Table.Td
                            key={day}
                            style={{
                              borderBottom: `1px solid ${SURFACE_BORDER}`,
                              borderRight: dayIdx < 4 ? `1px solid ${SURFACE_BORDER}` : undefined,
                              padding: '6px 10px',
                              background: 'rgba(64, 192, 87, 0.04)',
                              verticalAlign: 'middle',
                              textAlign: 'center',
                            }}
                          >
                            <Text size="xs" c="rgba(64, 192, 87, 0.4)">
                              свободно
                            </Text>
                          </Table.Td>
                        );
                      })}
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      ) : (
        <Paper
          style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}` }}
          p="xl"
          radius="sm"
        >
          <Text c="dimmed" ta="center" size="sm">
            Выберите педагога для просмотра расписания
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
