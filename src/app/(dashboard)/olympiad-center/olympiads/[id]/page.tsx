'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconAward, IconDeviceFloppy, IconFileSpreadsheet, IconTrash, IconUserPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EXCEL_EXPORT_RESULTS_LABEL, exportOlympiadResultsExcel } from '@/modules/olympiad/excel';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;

const STATUS_OPTIONS = [
  { value: 'enrolled', label: 'Записан' },
  { value: 'participated', label: 'Участвовал' },
  { value: 'no_show', label: 'Не явился' },
];

const LEVEL_LABELS: Record<string, string> = {
  school: 'Школьный',
  district: 'Районный',
  city: 'Городской',
  republic: 'Республиканский',
  international: 'Международный',
};

type AwardValue = { value: string; label: string; weight?: number };
type TourValue = { name?: string; datetime?: string };
type OlympiadDetail = {
  olympiad: {
    id: string;
    name: string;
    level: string;
    stage: string | null;
    date: string;
    regDeadline: string | null;
    resultsDate: string | null;
    tours: unknown;
    awardScheme: { id: string; name: string; values: unknown } | null;
  };
  enrollments: Enrollment[];
};
type Enrollment = {
  id: string;
  studentId: string;
  fio: string;
  className: string;
  tour: string | null;
  status: string | null;
  awardValue: string | null;
  score: number | null;
  comment: string | null;
};
type Student = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  class?: { grade: number; letter: string } | null;
};
type Draft = {
  status: string;
  awardValue: string | null;
  score: number | null;
  comment: string;
};

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function studentLabel(student: Student) {
  const fio = [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
  const className = student.class ? `${student.class.grade}${student.class.letter}` : '';
  return [fio, className].filter(Boolean).join(' · ');
}

function parseTours(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      return String((item as TourValue).name ?? '').trim() || null;
    })
    .filter((item): item is string => Boolean(item));
}

function parseAwards(value: unknown): AwardValue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const value = String(row.value ?? '').trim();
      if (!value) return null;
      const award: AwardValue = { value, label: String(row.label ?? value) };
      if (typeof row.weight === 'number') award.weight = row.weight;
      return award;
    })
    .filter((item): item is AwardValue => Boolean(item));
}

function initialDraft(row: Enrollment): Draft {
  return {
    status: row.status ?? 'enrolled',
    awardValue: row.awardValue,
    score: row.score,
    comment: row.comment ?? '',
  };
}

function OlympiadEnrollmentsContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [studentSearch, setStudentSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(studentSearch, 250);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [tour, setTour] = useState<string | null>(null);
  const [deadlineConfirm, setDeadlineConfirm] = useState<{ studentId: string; tour: string | null } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const detailQuery = useQuery<OlympiadDetail>({
    queryKey: ['olympiad-enrollments', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/olympiad-center/olympiads/${id}/enrollments`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить записи');
      return json.data;
    },
  });

  const studentsQuery = useQuery<Student[]>({
    queryKey: ['students-search', debouncedSearch],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (debouncedSearch.trim()) searchParams.set('search', debouncedSearch.trim());
      const res = await fetch(`/api/v1/students?${searchParams.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось найти учеников');
      return json.data;
    },
    enabled: debouncedSearch.trim().length >= 2,
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setDrafts((current) => {
      const next: Record<string, Draft> = {};
      for (const row of detailQuery.data.enrollments) next[row.id] = current[row.id] ?? initialDraft(row);
      return next;
    });
  }, [detailQuery.data]);

  const setPayload = (data: OlympiadDetail) => {
    queryClient.setQueryData(['olympiad-enrollments', id], data);
  };

  const addEnrollment = useMutation({
    mutationFn: async (payload: { studentId: string; tour: string | null; confirmDeadline?: boolean }) => {
      const res = await fetch(`/api/v1/olympiad-center/olympiads/${id}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        const code = json.error?.code;
        const message = json.error?.message ?? 'Не удалось записать ученика';
        const error = new Error(message) as Error & { code?: string };
        error.code = code;
        throw error;
      }
      return json.data as OlympiadDetail;
    },
    onSuccess: (data) => {
      setPayload(data);
      setStudentId(null);
      setStudentSearch('');
      setDeadlineConfirm(null);
      notifications.show({ color: 'green', title: 'Готово', message: 'Ученик записан' });
    },
    onError: (error) => {
      if ((error as Error & { code?: string }).code === 'DEADLINE_PASSED' && studentId) {
        setDeadlineConfirm({ studentId, tour });
        return;
      }
      notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось записать ученика' });
    },
  });

  const removeEnrollment = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const res = await fetch(`/api/v1/olympiad-center/olympiads/${id}/enrollments?enrollmentId=${encodeURIComponent(enrollmentId)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось удалить запись');
      return json.data as OlympiadDetail;
    },
    onSuccess: setPayload,
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось удалить запись' }),
  });

  const saveResult = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const draft = drafts[enrollmentId];
      if (!draft) throw new Error('Нет данных для сохранения');
      const res = await fetch(`/api/v1/olympiad-center/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось сохранить результат');
      return json.data as Enrollment;
    },
    onSuccess: () => {
      notifications.show({ color: 'green', title: 'Готово', message: 'Результат сохранён' });
      queryClient.invalidateQueries({ queryKey: ['olympiad-enrollments', id] });
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось сохранить результат' }),
  });

  const data = detailQuery.data;
  const tours = useMemo(() => parseTours(data?.olympiad.tours), [data?.olympiad.tours]);
  const awards = useMemo(() => parseAwards(data?.olympiad.awardScheme?.values), [data?.olympiad.awardScheme?.values]);
  const enrolledStudentIds = new Set(data?.enrollments.map((row) => row.studentId) ?? []);
  const studentOptions = (studentsQuery.data ?? [])
    .filter((student) => !enrolledStudentIds.has(student.id))
    .map((student) => ({ value: student.id, label: studentLabel(student) }));

  if (detailQuery.isLoading) return <Group justify="center" py="xl"><Loader /></Group>;
  if (detailQuery.isError || !data) return <Text c="red">Не удалось загрузить олимпиаду</Text>;

  const olympiad = data.olympiad;
  const handleResultsExport = () => exportOlympiadResultsExcel(data);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <ThemeIcon size={42} radius="sm" color="orange" variant="light"><IconAward size={24} /></ThemeIcon>
          <div>
            <Title order={2}>{olympiad.name}</Title>
            <Group gap="xs" mt={4}>
              <Badge variant="light" color="orange" radius="sm">{LEVEL_LABELS[olympiad.level] ?? olympiad.level}</Badge>
              {olympiad.stage && <Badge variant="light" color="gray" radius="sm">{olympiad.stage}</Badge>}
              <Text size="sm" c="dimmed">{fmtDate(olympiad.date)}</Text>
              <Text size="sm" c="dimmed">Дедлайн: {fmtDate(olympiad.regDeadline)}</Text>
              <Text size="sm" c="dimmed">Результаты: {fmtDate(olympiad.resultsDate)}</Text>
            </Group>
            <Text size="sm" c="dimmed" mt={4}>Схема наград: {olympiad.awardScheme?.name ?? '—'}</Text>
          </div>
        </Group>
        <Button component={Link} href="/olympiad-center/olympiads" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
          Назад
        </Button>
      </Group>

      <Paper withBorder radius="sm" p="md">
        <Group justify="space-between" mb="sm" align="flex-end">
          <Group gap="xs"><IconUserPlus size={18} /><Text fw={700}>Записи</Text><Badge variant="light" radius="sm">{data.enrollments.length}</Badge></Group>
          <Group gap="xs" align="flex-end">
            <Select
              label="Ученик"
              placeholder="Введите ФИО"
              data={studentOptions}
              value={studentId}
              onChange={setStudentId}
              searchValue={studentSearch}
              onSearchChange={setStudentSearch}
              searchable
              clearable
              nothingFoundMessage={debouncedSearch.trim().length < 2 ? 'Минимум 2 символа' : 'Ученики не найдены'}
              w={340}
            />
            {tours.length > 0 && (
              <Select label="Тур" data={tours.map((value) => ({ value, label: value }))} value={tour} onChange={setTour} clearable w={180} />
            )}
            <Button loading={addEnrollment.isPending} disabled={!studentId} onClick={() => studentId && addEnrollment.mutate({ studentId, tour })}>
              Записать
            </Button>
          </Group>
        </Group>

        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={760}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ФИО</Table.Th>
                <Table.Th>Класс</Table.Th>
                <Table.Th>Тур</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th w={60}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.enrollments.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td><Text fw={600}>{row.fio}</Text></Table.Td>
                  <Table.Td>{row.className || '—'}</Table.Td>
                  <Table.Td>{row.tour || '—'}</Table.Td>
                  <Table.Td>{STATUS_OPTIONS.find((item) => item.value === row.status)?.label ?? row.status ?? '—'}</Table.Td>
                  <Table.Td>
                    <Tooltip label="Удалить">
                      <ActionIcon color="red" variant="subtle" onClick={() => removeEnrollment.mutate(row.id)} loading={removeEnrollment.isPending}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.enrollments.length === 0 && (
                <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="lg">Записей пока нет</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Paper withBorder radius="sm" p="md">
        <Group gap="xs" mb="sm"><IconAward size={18} /><Text fw={700}>Результаты</Text></Group>
        {data.enrollments.length > 0 && (
          <Button variant="light" mb="sm" leftSection={<IconFileSpreadsheet size={16} />} onClick={handleResultsExport}>
            {EXCEL_EXPORT_RESULTS_LABEL}
          </Button>
        )}
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={980}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th miw={220}>Ученик</Table.Th>
                <Table.Th miw={160}>Статус</Table.Th>
                <Table.Th miw={170}>Награда</Table.Th>
                <Table.Th miw={120}>Балл</Table.Th>
                <Table.Th miw={240}>Комментарий</Table.Th>
                <Table.Th w={110}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.enrollments.map((row) => {
                const draft = drafts[row.id] ?? initialDraft(row);
                const participated = draft.status === 'participated';
                return (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Text fw={600}>{row.fio}</Text>
                      <Text size="xs" c="dimmed">{[row.className, row.tour].filter(Boolean).join(' · ') || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Select
                        data={STATUS_OPTIONS}
                        value={draft.status}
                        onChange={(value) => value && setDrafts((current) => ({ ...current, [row.id]: { ...draft, status: value, awardValue: value === 'participated' ? draft.awardValue : null } }))}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        data={awards.map((award) => ({ value: award.value, label: award.label }))}
                        value={draft.awardValue}
                        onChange={(value) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, awardValue: value } }))}
                        disabled={!participated}
                        clearable
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={draft.score ?? undefined}
                        onChange={(value) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, score: typeof value === 'number' ? value : null } }))}
                        min={0}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Textarea
                        value={draft.comment}
                        onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, comment: event.currentTarget.value } }))}
                        autosize
                        minRows={1}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="compact-sm"
                        leftSection={<IconDeviceFloppy size={14} />}
                        loading={saveResult.isPending}
                        onClick={() => saveResult.mutate(row.id)}
                      >
                        Сохранить
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {data.enrollments.length === 0 && (
                <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" ta="center" py="lg">Добавьте записи, чтобы внести результаты</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Modal opened={Boolean(deadlineConfirm)} onClose={() => setDeadlineConfirm(null)} title="Дедлайн прошёл" centered>
        <Stack gap="md">
          <Text size="sm">Записать ученика всё равно?</Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setDeadlineConfirm(null)}>Отмена</Button>
            <Button
              loading={addEnrollment.isPending}
              onClick={() => deadlineConfirm && addEnrollment.mutate({ ...deadlineConfirm, confirmDeadline: true })}
            >
              Записать
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function OlympiadEnrollmentsPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <OlympiadEnrollmentsContent />
    </RoleGate>
  );
}
