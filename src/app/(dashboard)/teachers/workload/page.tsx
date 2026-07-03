'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconArrowLeft, IconArrowsExchange } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRole } from '@/shared/hooks/useRole';

/* ── Colors ── */
const SURFACE = '#ffffff';
const SURFACE_BORDER = '#e6e9ee';
const TEXT_DIM = '#5c5f66';
const TEXT_SEC = 'var(--mantine-color-dimmed)';
const PINK = '#e91e8c';

const thStyle: React.CSSProperties = {
  color: TEXT_SEC,
  fontSize: 11,
  fontWeight: 600,
  borderBottom: `1px solid ${SURFACE_BORDER}`,
  borderRight: `1px solid ${SURFACE_BORDER}`,
  padding: '6px 8px',
  background: '#fbfcfd',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  color: 'var(--mantine-color-text)',
  fontSize: 12,
  borderBottom: `1px solid ${SURFACE_BORDER}`,
  borderRight: `1px solid ${SURFACE_BORDER}`,
  padding: '4px 6px',
  textAlign: 'center',
  verticalAlign: 'middle',
};

const tdNameStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'left',
  whiteSpace: 'nowrap',
  position: 'sticky' as const,
  left: 0,
  background: SURFACE,
  zIndex: 1,
  minWidth: 180,
};

interface TeacherShort {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  position?: string | null;
}

interface ClassShort {
  id: string;
  grade: number;
  letter: string;
  level: { id: string; name: string };
}

interface WorkloadEntry {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  hours: number;
}

interface WorkloadResponse {
  success: boolean;
  data: {
    teachers: TeacherShort[];
    classes: ClassShort[];
    workloadMap: Record<string, Record<string, WorkloadEntry[]>>;
  };
}

function getFullName(t: { lastName: string; firstName: string; middleName?: string | null }) {
  return [t.lastName, `${t.firstName[0]}.`, t.middleName ? `${t.middleName[0]}.` : '']
    .filter(Boolean)
    .join(' ');
}

export default function WorkloadPage() {
  const { data, isLoading, error } = useQuery<WorkloadResponse>({
    queryKey: ['workload-table'],
    queryFn: async () => {
      const res = await fetch('/api/v1/workload');
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  const teachers = data?.data?.teachers || [];
  const classes = data?.data?.classes || [];
  const workloadMap = data?.data?.workloadMap || {};

  const queryClient = useQueryClient();
  const { role } = useRole();
  const canTransfer = role === 'super_admin' || role === 'zavuch';

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferCtx, setTransferCtx] = useState<{
    fromTeacherId: string;
    fromTeacherName: string;
    classId: string;
    classLabel: string;
    subjectId: string;
    subjectName: string;
    hours: number;
  } | null>(null);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferReason, setTransferReason] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  function openTransfer(ctx: NonNullable<typeof transferCtx>) {
    setTransferCtx(ctx);
    setTransferTarget(null);
    setTransferReason('');
    setTransferError(null);
    setTransferOpen(true);
  }

  async function submitTransfer() {
    if (!transferCtx || !transferTarget) {
      setTransferError('Выберите учителя-получателя');
      return;
    }
    setTransferLoading(true);
    setTransferError(null);
    try {
      const res = await fetch('/api/v1/workload/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTeacherId: transferCtx.fromTeacherId,
          toTeacherId: transferTarget,
          subjectId: transferCtx.subjectId,
          classId: transferCtx.classId,
          reason: transferReason || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка');
      notifications.show({
        title: 'Нагрузка передана',
        message: `${transferCtx.subjectName} (${transferCtx.classLabel}) — ${transferCtx.hours}ч`,
        color: 'green',
      });
      setTransferOpen(false);
      queryClient.invalidateQueries({ queryKey: ['workload-table'] });
    } catch (e: unknown) {
      setTransferError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setTransferLoading(false);
    }
  }

  if (isLoading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Loader color="bilimosBlue" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        style={{
          background: SURFACE,
          borderRadius: 6,
          border: `1px solid ${SURFACE_BORDER}`,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <Text c="red" size="sm">
          Ошибка загрузки данных
        </Text>
      </Box>
    );
  }

  return (
    <Stack gap="md">
      {/* Breadcrumb */}
      <Group gap={4}>
        <Link href="/teachers" style={{ textDecoration: 'none' }}>
          <Group gap={4}>
            <IconArrowLeft size={14} color={TEXT_SEC} />
            <Text size="xs" c={TEXT_SEC}>
              Педагоги предметники
            </Text>
          </Group>
        </Link>
        <Text size="xs" c={TEXT_DIM}>
          /
        </Text>
        <Text size="xs" c={PINK}>
          Сводная таблица нагрузки
        </Text>
      </Group>

      {/* Title */}
      <Text fw={700} size="xl" c="var(--mantine-color-text)">
        Сводная таблица нагрузки
      </Text>

      {/* Summary */}
      <Group gap="lg">
        <Box
          style={{
            background: SURFACE,
            borderRadius: 6,
            border: `1px solid ${SURFACE_BORDER}`,
            padding: '8px 16px',
          }}
        >
          <Text size="xs" c={TEXT_DIM}>
            Педагогов
          </Text>
          <Text size="sm" fw={600} c="var(--mantine-color-text)">
            {teachers.length}
          </Text>
        </Box>
        <Box
          style={{
            background: SURFACE,
            borderRadius: 6,
            border: `1px solid ${SURFACE_BORDER}`,
            padding: '8px 16px',
          }}
        >
          <Text size="xs" c={TEXT_DIM}>
            Классов
          </Text>
          <Text size="sm" fw={600} c="var(--mantine-color-text)">
            {classes.length}
          </Text>
        </Box>
      </Group>

      {/* Workload Table */}
      <Box
        style={{
          background: SURFACE,
          borderRadius: 6,
          border: `1px solid ${SURFACE_BORDER}`,
          overflow: 'hidden',
        }}
      >
        <ScrollArea type="auto" style={{ width: '100%' }}>
          <Table
            style={{
              borderCollapse: 'collapse',
              minWidth: classes.length * 80 + 200,
            }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  style={{
                    ...thStyle,
                    textAlign: 'left',
                    position: 'sticky',
                    left: 0,
                    background: '#fbfcfd',
                    zIndex: 2,
                    minWidth: 180,
                  }}
                >
                  Педагог
                </Table.Th>
                {classes.map((cls) => (
                  <Table.Th key={cls.id} style={thStyle}>
                    {cls.grade}
                    {cls.letter}
                  </Table.Th>
                ))}
                <Table.Th style={{ ...thStyle, background: '#e6e9ee' }}>Итого</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {teachers.map((teacher) => {
                const teacherWorkload = workloadMap[teacher.id] || {};
                let totalHours = 0;

                return (
                  <Table.Tr key={teacher.id}>
                    <Table.Td style={tdNameStyle}>
                      <Link
                        href={`/teachers/${teacher.id}`}
                        style={{ textDecoration: 'none', color: '#228be6' }}
                      >
                        <Text size="xs" fw={500}>
                          {getFullName(teacher)}
                        </Text>
                      </Link>
                      {teacher.position && (
                        <Text size="xs" c={TEXT_DIM} lh={1.2}>
                          {teacher.position}
                        </Text>
                      )}
                    </Table.Td>
                    {classes.map((cls) => {
                      const entries = teacherWorkload[cls.id];
                      if (!entries || entries.length === 0) {
                        return (
                          <Table.Td key={cls.id} style={tdStyle}>
                            <Text size="xs" c={TEXT_DIM}>
                              -
                            </Text>
                          </Table.Td>
                        );
                      }

                      const cellHours = entries.reduce((s, e) => s + e.hours, 0);
                      totalHours += cellHours;

                      return (
                        <Table.Td key={cls.id} style={tdStyle}>
                          <Stack gap={2} align="center">
                            {entries.map((entry) => (
                              <Group key={entry.subjectId} gap={2} wrap="nowrap" justify="center">
                                <Badge
                                  size="xs"
                                  radius="sm"
                                  variant="light"
                                  color={entry.subjectColor || 'blue'}
                                >
                                  {entry.subjectName} {entry.hours}ч
                                </Badge>
                                {canTransfer && (
                                  <Tooltip label="Передать нагрузку другому педагогу" withArrow>
                                    <ActionIcon
                                      size="xs"
                                      variant="subtle"
                                      color="gray"
                                      onClick={() =>
                                        openTransfer({
                                          fromTeacherId: teacher.id,
                                          fromTeacherName: getFullName(teacher),
                                          classId: cls.id,
                                          classLabel: `${cls.grade}${cls.letter}`,
                                          subjectId: entry.subjectId,
                                          subjectName: entry.subjectName,
                                          hours: entry.hours,
                                        })
                                      }
                                    >
                                      <IconArrowsExchange size={12} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </Group>
                            ))}
                          </Stack>
                        </Table.Td>
                      );
                    })}
                    <Table.Td
                      style={{
                        ...tdStyle,
                        background: '#fbfcfd',
                        fontWeight: 600,
                      }}
                    >
                      {(() => {
                        // Recalculate total from all class entries
                        const tw = workloadMap[teacher.id] || {};
                        const total = Object.values(tw).reduce(
                          (sum, entries) =>
                            sum + entries.reduce((s, e) => s + e.hours, 0),
                          0
                        );
                        return `${total}ч`;
                      })()}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {teachers.length === 0 && (
                <Table.Tr>
                  <Table.Td
                    colSpan={classes.length + 2}
                    style={{ ...tdStyle, textAlign: 'center' }}
                  >
                    <Text size="sm" c={TEXT_DIM} py="lg">
                      Нет данных о нагрузке
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Box>

      <Modal
        opened={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Передача нагрузки"
        size="md"
      >
        {transferCtx && (
          <Stack>
            {transferError && (
              <Alert color="red" icon={<IconAlertCircle size={14} />}>
                {transferError}
              </Alert>
            )}
            <Box>
              <Text size="sm" fw={500}>{transferCtx.subjectName} в классе {transferCtx.classLabel} — {transferCtx.hours}ч/нед</Text>
              <Text size="xs" c="dimmed">От: {transferCtx.fromTeacherName}</Text>
              <Text size="xs" c="dimmed" mt={4}>
                Прошлые оценки и записи расписания останутся у предыдущего педагога,
                новый увидит их в режиме «только чтение» (по ТЗ).
              </Text>
            </Box>
            <Select
              label="Получатель"
              placeholder="Выберите педагога"
              value={transferTarget}
              onChange={setTransferTarget}
              data={teachers
                .filter((t) => t.id !== transferCtx.fromTeacherId)
                .map((t) => ({ value: t.id, label: getFullName(t) }))}
              searchable
              required
            />
            <Textarea
              label="Причина (необязательно)"
              placeholder="Декрет, длительная болезнь, увольнение, замена и т.п."
              value={transferReason}
              onChange={(e) => setTransferReason(e.currentTarget.value)}
              minRows={2}
              maxLength={500}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setTransferOpen(false)} disabled={transferLoading}>
                Отмена
              </Button>
              <Button onClick={submitTransfer} loading={transferLoading}>
                Передать
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
