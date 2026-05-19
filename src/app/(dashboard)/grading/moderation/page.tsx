'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconHistory,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { useRole } from '@/shared/hooks/useRole';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface ModerationGrade {
  id: string;
  value: number;
  scale: 'FIVE' | 'TWELVE' | 'HUNDRED' | 'LETTER';
  status: 'draft' | 'submitted' | 'moderated' | 'published';
  date: string;
  createdAt: string;
  comment: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    class: { id: string; grade: number; letter: string } | null;
  };
  subject: { id: string; name: string };
  category: { id: string; name: string; weight: number };
  teacher: { id: string; firstName: string; lastName: string };
  period: { id: string; name: string };
}

interface PeriodOption {
  id: string;
  name: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  submitted: { label: 'На модерации (завуч)', color: 'orange' },
  moderated: { label: 'Утверждено завучем', color: 'blue' },
  published: { label: 'Опубликовано', color: 'green' },
  draft: { label: 'Черновик', color: 'gray' },
};

const SCALE_LABEL: Record<string, string> = {
  FIVE: '5-балльная',
  TWELVE: '12-балльная',
  HUNDRED: '100%',
  LETTER: 'A-F',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatStudentName(s: ModerationGrade['student']): string {
  return [s.lastName, s.firstName, s.middleName].filter(Boolean).join(' ');
}

function ModerationPageInner() {
  const { role } = useRole();
  const [grades, setGrades] = useState<ModerationGrade[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'moderated'>('all');
  const [periodFilter, setPeriodFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [auditOpen, setAuditOpen] = useState<string | null>(null);
  const [audit, setAudit] = useState<Array<{ id: string; action: string; createdAt: string; oldValue: number | null; newValue: number | null }>>([]);

  async function loadGrades() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/v1/grading/moderation?${params.toString()}`);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? 'Не удалось загрузить оценки');
      }
      let list = json.data as ModerationGrade[];
      if (periodFilter) list = list.filter((g) => g.period.id === periodFilter);
      setGrades(list);
      setSelected(new Set());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  async function loadPeriods() {
    try {
      const res = await fetch('/api/v1/periods');
      const json = await res.json();
      if (json.success) {
        setPeriods((json.data as PeriodOption[]).map((p) => ({ id: p.id, name: p.name })));
      }
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    loadGrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, periodFilter]);

  const submittedCount = useMemo(
    () => grades.filter((g) => g.status === 'submitted').length,
    [grades],
  );
  const moderatedCount = useMemo(
    () => grades.filter((g) => g.status === 'moderated').length,
    [grades],
  );

  const allSelected = grades.length > 0 && selected.size === grades.length;
  const someSelected = selected.size > 0 && selected.size < grades.length;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(grades.map((g) => g.id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function moderate(action: 'approve' | 'reject', comment?: string) {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/grading/moderation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradeIds: Array.from(selected),
          action,
          comment,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка модерации');
      const errs = (json.data as Array<{ error?: string }>).filter((r) => r.error);
      if (errs.length > 0) {
        setError(`Часть оценок не обработана: ${errs.map((e) => e.error).join('; ')}`);
      }
      await loadGrades();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка модерации');
    } finally {
      setSubmitting(false);
      setRejectOpen(false);
      setRejectComment('');
    }
  }

  async function openAudit(gradeId: string) {
    setAuditOpen(gradeId);
    setAudit([]);
    try {
      const res = await fetch(`/api/v1/grading/audit?gradeId=${gradeId}`);
      const json = await res.json();
      if (json.success) {
        setAudit(json.data);
      }
    } catch {
      /* noop */
    }
  }

  // Какое действие может выполнить текущая роль для выделенных оценок
  const selectedGrades = grades.filter((g) => selected.has(g.id));
  const canApprove = useMemo(() => {
    if (selectedGrades.length === 0) return false;
    return selectedGrades.every((g) => {
      if (role === 'super_admin') return true;
      if (g.status === 'submitted' && role === 'zavuch') return true;
      if (g.status === 'moderated' && role === 'analyst') return true;
      return false;
    });
  }, [selectedGrades, role]);

  const approveLabel =
    role === 'analyst'
      ? 'Опубликовать (аналитик)'
      : role === 'zavuch'
        ? 'Утвердить (завуч)'
        : 'Одобрить';

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2}>Модерация оценок</Title>
          <Text size="sm" c="dimmed">
            На первичную модерацию завучу — {submittedCount}, на финальное утверждение аналитику — {moderatedCount}
          </Text>
        </Box>
        <Group>
          <Select
            label="Статус"
            value={statusFilter}
            onChange={(v) => setStatusFilter((v as 'all' | 'submitted' | 'moderated') ?? 'all')}
            data={[
              { value: 'all', label: 'Все на модерации' },
              { value: 'submitted', label: 'Только submitted' },
              { value: 'moderated', label: 'Только moderated' },
            ]}
            w={210}
          />
          <Select
            label="Период"
            value={periodFilter}
            onChange={setPeriodFilter}
            data={[
              ...periods.map((p) => ({ value: p.id, label: p.name })),
            ]}
            placeholder="Все периоды"
            clearable
            w={200}
          />
          <ActionIcon variant="subtle" size="lg" onClick={loadGrades} title="Обновить">
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {error}
        </Alert>
      )}

      <Group>
        <Button
          color="green"
          leftSection={<IconCheck size={16} />}
          disabled={!canApprove || submitting}
          onClick={() => moderate('approve')}
          loading={submitting}
        >
          {approveLabel} ({selected.size})
        </Button>
        <Button
          color="red"
          variant="light"
          leftSection={<IconX size={16} />}
          disabled={selected.size === 0 || submitting}
          onClick={() => setRejectOpen(true)}
        >
          Отклонить ({selected.size})
        </Button>
      </Group>

      <Card withBorder padding={0}>
        <ScrollArea>
          {loading ? (
            <Box p="xl" ta="center"><Loader /></Box>
          ) : grades.length === 0 ? (
            <Box p="xl" ta="center">
              <Text c="dimmed">Нет оценок для модерации</Text>
            </Box>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleAll}
                    />
                  </Table.Th>
                  <Table.Th>Ученик</Table.Th>
                  <Table.Th>Класс</Table.Th>
                  <Table.Th>Предмет</Table.Th>
                  <Table.Th>Категория</Table.Th>
                  <Table.Th>Оценка</Table.Th>
                  <Table.Th>Шкала</Table.Th>
                  <Table.Th>Период</Table.Th>
                  <Table.Th>Педагог</Table.Th>
                  <Table.Th>Дата</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th w={60}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {grades.map((g) => {
                  const status = STATUS_LABEL[g.status] ?? { label: g.status, color: 'gray' };
                  return (
                    <Table.Tr key={g.id}>
                      <Table.Td>
                        <Checkbox
                          checked={selected.has(g.id)}
                          onChange={() => toggleOne(g.id)}
                        />
                      </Table.Td>
                      <Table.Td>{formatStudentName(g.student)}</Table.Td>
                      <Table.Td>
                        {g.student.class
                          ? `${g.student.class.grade}${g.student.class.letter}`
                          : '—'}
                      </Table.Td>
                      <Table.Td>{g.subject.name}</Table.Td>
                      <Table.Td>
                        <Tooltip label={`Вес: ${g.category.weight}`}>
                          <span>{g.category.name}</span>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td><b>{g.value}</b></Table.Td>
                      <Table.Td>{SCALE_LABEL[g.scale] ?? g.scale}</Table.Td>
                      <Table.Td>{g.period.name}</Table.Td>
                      <Table.Td>
                        {g.teacher.lastName} {g.teacher.firstName[0]}.
                      </Table.Td>
                      <Table.Td>{formatDate(g.date)}</Table.Td>
                      <Table.Td>
                        <Badge color={status.color} variant="light" size="sm">
                          {status.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          onClick={() => openAudit(g.id)}
                          title="История изменений"
                        >
                          <IconHistory size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </ScrollArea>
      </Card>

      <Modal
        opened={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Отклонить выбранные оценки"
      >
        <Stack>
          <Textarea
            label="Причина (необязательно)"
            placeholder="Опишите причину отклонения, если необходимо"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.currentTarget.value)}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRejectOpen(false)}>
              Отмена
            </Button>
            <Button color="red" onClick={() => moderate('reject', rejectComment || undefined)} loading={submitting}>
              Отклонить
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={auditOpen !== null}
        onClose={() => setAuditOpen(null)}
        title="История изменений оценки"
        size="lg"
      >
        {audit.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">
            Нет записей в истории
          </Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Когда</Table.Th>
                <Table.Th>Действие</Table.Th>
                <Table.Th>Было</Table.Th>
                <Table.Th>Стало</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {audit.map((a) => (
                <Table.Tr key={a.id}>
                  <Table.Td>
                    {new Date(a.createdAt).toLocaleString('ru-RU')}
                  </Table.Td>
                  <Table.Td><Text size="xs" style={{ wordBreak: 'break-word' }}>{a.action}</Text></Table.Td>
                  <Table.Td>{a.oldValue ?? '—'}</Table.Td>
                  <Table.Td>{a.newValue ?? '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Modal>
    </Stack>
  );
}

export default function ModerationPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch']}>
      <ModerationPageInner />
    </RoleGate>
  );
}
