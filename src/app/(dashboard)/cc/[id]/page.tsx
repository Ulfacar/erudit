'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Avatar,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarDue,
  IconCertificate,
  IconFileText,
  IconFlag,
  IconMessageCircle,
  IconPencil,
  IconSchool,
  IconStar,
  IconTargetArrow,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import {
  CC_ADMISSION_STATUS_LABELS,
  CC_CONFLICT_STATUS_LABELS,
  CC_DEADLINE_TYPE_LABELS,
  CC_DOC_STATUS_LABELS,
  CC_DOC_TYPE_LABELS,
  CC_EXAM_TYPE_LABELS,
} from '@/modules/cc/labels';
import { CcPipelineKanban, type CcKanbanApplication } from '../CcPipelineKanban';

const CC_ROLES = ['college_counselor', 'super_admin'] as const;
const DOC_STATUS_COLOR: Record<string, string> = {
  not_started: 'gray',
  draft: 'blue',
  in_review: 'yellow',
  ready: 'green',
  received: 'teal',
};

type CcProfile = {
  id: string;
  studentId: string;
  studentCountries: string[];
  studentMajor?: string | null;
  studentMotivation?: string | null;
  parentCountries: string[];
  parentBudgetUsd?: number | null;
  parentMajor?: string | null;
  parentSafety: boolean;
  parentExpectations?: string | null;
  conflictStatus: 'green' | 'yellow' | 'red';
  riskFlagCleared: boolean;
  counselorComment?: string | null;
  strategyAssigned: boolean;
  gpa: number | null;
  bestScores: { sat: number | null; ielts: number | null };
  student: {
    id: string;
    fio: string;
    className: string;
    dateOfBirth?: string | null;
    photo?: string | null;
    parents: { id: string; fio: string; phone?: string | null; relation: string }[];
  };
  exams: { id: string; examType: string; testDate?: string | null; scoreCurrent?: number | null; scoreTarget?: number | null; isMock: boolean; verified: boolean; comment?: string | null }[];
  applications: CcKanbanApplication[];
  documents: { id: string; docType: string; status: string; fileUrl?: string | null; requestedDeadline?: string | null; requiredCount?: number | null; comment?: string | null }[];
  meetings: { id: string; meetingDate: string; topic?: string | null; notes?: string | null; actionItems?: string | null; format?: string | null }[];
  deadlines: { id: string; date: string; title: string; type: string; status: string; daysLeft: number }[];
};

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function daysColor(days: number) {
  if (days <= 7) return 'red';
  if (days <= 30) return 'yellow';
  return 'blue';
}

function deadlineTitle(deadline: CcProfile['deadlines'][number]) {
  return deadline.type === 'exam'
    ? (CC_EXAM_TYPE_LABELS[deadline.title as keyof typeof CC_EXAM_TYPE_LABELS] ?? deadline.title)
    : deadline.title;
}

function deadlineCategory(deadline: CcProfile['deadlines'][number]) {
  return deadline.type === 'exam'
    ? CC_DEADLINE_TYPE_LABELS.exam
    : CC_DEADLINE_TYPE_LABELS.application;
}

function currentAcademicYearBounds() {
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: new Date(startYear, 7, 1),
    end: new Date(startYear + 1, 6, 31, 23, 59, 59),
  };
}

function validateDeadline(value: string) {
  const date = new Date(value);
  const { start, end } = currentAcademicYearBounds();
  if (date.getTime() < Date.now()) return 'Нельзя ставить прошедший дедлайн';
  if (date < start || date > end) return 'Дедлайн должен быть в текущем учебном году';
  return null;
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Paper withBorder radius="sm" p="md">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant="light" radius="sm" color="blue">{icon}</ThemeIcon>
        <div>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text fw={700}>{value}</Text>
        </div>
      </Group>
    </Paper>
  );
}

function ProfileEditModal({ profile, opened, onClose }: { profile: CcProfile; opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [studentCountries, setStudentCountries] = useState(profile.studentCountries);
  const [studentMajor, setStudentMajor] = useState(profile.studentMajor ?? '');
  const [studentMotivation, setStudentMotivation] = useState(profile.studentMotivation ?? '');
  const [parentCountries, setParentCountries] = useState(profile.parentCountries);
  const [parentBudgetUsd, setParentBudgetUsd] = useState<number | ''>(profile.parentBudgetUsd ?? '');
  const [parentMajor, setParentMajor] = useState(profile.parentMajor ?? '');
  const [parentSafety, setParentSafety] = useState(profile.parentSafety);
  const [parentExpectations, setParentExpectations] = useState(profile.parentExpectations ?? '');
  const [counselorComment, setCounselorComment] = useState(profile.counselorComment ?? '');
  const [strategyAssigned, setStrategyAssigned] = useState(profile.strategyAssigned);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/cc/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentCountries,
          studentMajor: studentMajor || null,
          studentMotivation: studentMotivation || null,
          parentCountries,
          parentBudgetUsd: parentBudgetUsd === '' ? null : parentBudgetUsd,
          parentMajor: parentMajor || null,
          parentSafety,
          parentExpectations: parentExpectations || null,
          counselorComment: counselorComment || null,
          strategyAssigned,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось сохранить профиль');
      return json.data;
    },
    onSuccess: () => {
      notifications.show({ color: 'green', title: 'Сохранено', message: 'Профиль обновлён' });
      queryClient.invalidateQueries({ queryKey: ['cc-profile', profile.id] });
      onClose();
    },
    onError: (err) => notifications.show({ color: 'red', title: 'Ошибка', message: err instanceof Error ? err.message : 'Не удалось сохранить профиль' }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Редактировать профиль" size="lg">
      <Stack gap="sm">
        <TagsInput label="Страны ученика" data={studentCountries} value={studentCountries} onChange={setStudentCountries} clearable />
        <TextInput label="Специальность ученика" value={studentMajor} onChange={(e) => setStudentMajor(e.currentTarget.value)} />
        <Textarea label="Мотивация" value={studentMotivation} onChange={(e) => setStudentMotivation(e.currentTarget.value)} minRows={3} />
        <TagsInput label="Страны родителей" data={parentCountries} value={parentCountries} onChange={setParentCountries} clearable />
        <NumberInput label="Бюджет, USD" value={parentBudgetUsd} onChange={(v) => setParentBudgetUsd(typeof v === 'number' ? v : '')} min={0} />
        <TextInput label="Специальность родителей" value={parentMajor} onChange={(e) => setParentMajor(e.currentTarget.value)} />
        <Switch label="Безопасность локации критична" checked={parentSafety} onChange={(e) => setParentSafety(e.currentTarget.checked)} />
        <Textarea label="Ожидания родителей" value={parentExpectations} onChange={(e) => setParentExpectations(e.currentTarget.value)} minRows={3} />
        <Textarea label="Комментарий консультанта" value={counselorComment} onChange={(e) => setCounselorComment(e.currentTarget.value)} minRows={3} />
        <Switch label="Стратегия назначена" checked={strategyAssigned} onChange={(e) => setStrategyAssigned(e.currentTarget.checked)} />
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>Сохранить</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function AddApplicationModal({ profileId, opened, onClose }: { profileId: string; opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [universityName, setUniversityName] = useState('');
  const [country, setCountry] = useState('');
  const [program, setProgram] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const deadlineError = deadlineDate ? validateDeadline(deadlineDate) : null;
      if (deadlineError) throw new Error(deadlineError);
      const res = await fetch('/api/v1/cc/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, universityName, country: country || null, program: program || null, deadlineDate: deadlineDate || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось добавить вуз');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-profile', profileId] });
      onClose();
      setUniversityName('');
      setCountry('');
      setProgram('');
      setDeadlineDate('');
    },
    onError: (err) => notifications.show({ color: 'red', title: 'Ошибка', message: err instanceof Error ? err.message : 'Не удалось добавить вуз' }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Добавить вуз" centered>
      <Stack gap="sm">
        <TextInput label="Университет" value={universityName} onChange={(e) => setUniversityName(e.currentTarget.value)} required />
        <TextInput label="Страна" value={country} onChange={(e) => setCountry(e.currentTarget.value)} />
        <TextInput label="Программа" value={program} onChange={(e) => setProgram(e.currentTarget.value)} />
        <TextInput label="Дедлайн" type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button loading={mutation.isPending} disabled={!universityName.trim()} onClick={() => mutation.mutate()}>Добавить</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function AddMeetingModal({ profileId, opened, onClose }: { profileId: string; opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState('');
  const [notes, setNotes] = useState('');
  const [actionItems, setActionItems] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/cc/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, topic: topic || null, format: format || null, notes: notes || null, actionItems: actionItems || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось добавить встречу');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-profile', profileId] });
      onClose();
      setTopic('');
      setFormat('');
      setNotes('');
      setActionItems('');
    },
    onError: (err) => notifications.show({ color: 'red', title: 'Ошибка', message: err instanceof Error ? err.message : 'Не удалось добавить встречу' }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Новая встреча" centered>
      <Stack gap="sm">
        <TextInput label="Тема" value={topic} onChange={(e) => setTopic(e.currentTarget.value)} />
        <TextInput label="Формат" value={format} onChange={(e) => setFormat(e.currentTarget.value)} />
        <Textarea label="Заметки" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} minRows={3} />
        <Textarea label="Следующие шаги" value={actionItems} onChange={(e) => setActionItems(e.currentTarget.value)} minRows={2} />
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>Добавить</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function CcProfileCard() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [appOpen, setAppOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [view, setView] = useState<'table' | 'kanban'>('table');

  const query = useQuery<CcProfile>({
    queryKey: ['cc-profile', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/cc/profiles/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить карточку');
      return json.data;
    },
  });

  const clearRisk = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/cc/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskFlagCleared: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось снять флаг');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-profile', id] });
      notifications.show({ color: 'green', title: 'Сохранено', message: 'RED-флаг снят' });
    },
    onError: (err) => notifications.show({ color: 'red', title: 'Ошибка', message: err instanceof Error ? err.message : 'Не удалось снять флаг' }),
  });

  if (query.isLoading) return <Group justify="center" py="xl"><Loader /></Group>;
  if (query.isError || !query.data) return <Text c="red">Не удалось загрузить карточку</Text>;

  const profile = query.data;
  const upcoming30 = profile.deadlines.filter((deadline) => deadline.daysLeft >= 0 && deadline.daysLeft <= 30);
  const bestMockScore = profile.exams.reduce<number | null>((max, exam) => {
    if (!exam.isMock || exam.scoreCurrent == null) return max;
    const score = Number(exam.scoreCurrent);
    return max == null || score > max ? score : max;
  }, null);
  const gpaText = profile.gpa == null ? '—' : `${profile.gpa}/5`;
  const conflictColor = profile.conflictStatus === 'red' ? 'red' : profile.conflictStatus === 'yellow' ? 'yellow' : 'green';

  return (
    <Stack gap="md">
      <Paper withBorder radius="sm" p="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <Avatar src={profile.student.photo || undefined} size={72} radius="xl">{initials(profile.student.fio)}</Avatar>
            <div>
              <Group gap="xs">
                <Title order={2}>{profile.student.fio} — {profile.student.className || 'класс не указан'}</Title>
                {profile.conflictStatus !== 'green' && <Badge color={conflictColor} variant="light" radius="sm" style={{ whiteSpace: 'nowrap' }}>{CC_CONFLICT_STATUS_LABELS[profile.conflictStatus]}</Badge>}
              </Group>
              <Text c="dimmed" size="sm">ID {profile.studentId} · {fmtDate(profile.student.dateOfBirth)}</Text>
              {profile.student.parents.length > 0 && (
                <Text size="sm" mt={4}>{profile.student.parents.map((parent) => `${parent.fio}${parent.phone ? ` (${parent.phone})` : ''}`).join(', ')}</Text>
              )}
            </div>
          </Group>
          <Button leftSection={<IconPencil size={16} />} onClick={() => setEditOpen(true)}>Редактировать профиль</Button>
        </Group>
      </Paper>

      {profile.conflictStatus === 'red' && !profile.riskFlagCleared && (
        <Paper withBorder radius="sm" p="md" style={{ borderColor: 'var(--mantine-color-red-4)' }}>
          <Group justify="space-between">
            <div>
              <Text fw={700}>Зона риска</Text>
              <Text size="sm" c="dimmed">Переход заявок в submitted заблокирован до снятия RED-флага.</Text>
            </div>
            <Button color="red" variant="light" loading={clearRisk.isPending} onClick={() => clearRisk.mutate()}>Снять флаг</Button>
          </Group>
        </Paper>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
        <StatTile icon={<IconStar size={18} />} label="GPA" value={gpaText} />
        <StatTile icon={<IconCertificate size={18} />} label="SAT" value={profile.bestScores.sat == null ? '—' : String(profile.bestScores.sat)} />
        <StatTile icon={<IconCertificate size={18} />} label="IELTS" value={profile.bestScores.ielts == null ? '—' : String(profile.bestScores.ielts)} />
        <StatTile icon={<IconSchool size={18} />} label="Заявки" value={String(profile.applications.length)} />
        <StatTile icon={<IconCalendarDue size={18} />} label="Дедлайны ≤30" value={String(upcoming30.length)} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <Stack gap="md">
          <Paper withBorder radius="sm" p="md">
            <Group gap="xs" mb="sm"><IconTargetArrow size={18} /><Text fw={700}>1. Цель ученика</Text></Group>
            <Text size="sm"><b>Страны:</b> {profile.studentCountries.join(', ') || '—'}</Text>
            <Text size="sm"><b>Major:</b> {profile.studentMajor || '—'}</Text>
            <Text size="sm" mt="xs">{profile.studentMotivation || 'Мотивация не заполнена'}</Text>
          </Paper>

          <Paper withBorder radius="sm" p="md">
            <Text fw={700} mb="sm">3. Академические результаты</Text>
            <Table verticalSpacing="xs">
              <Table.Tbody>
                <Table.Tr><Table.Td>GPA</Table.Td><Table.Td>{gpaText}</Table.Td></Table.Tr>
                <Table.Tr><Table.Td>SAT</Table.Td><Table.Td>{profile.bestScores.sat ?? '—'}</Table.Td></Table.Tr>
                <Table.Tr><Table.Td>IELTS</Table.Td><Table.Td>{profile.bestScores.ielts ?? '—'}</Table.Td></Table.Tr>
                <Table.Tr><Table.Td>Пробные тесты</Table.Td><Table.Td>{bestMockScore ?? '—'}</Table.Td></Table.Tr>
                <Table.Tr><Table.Td>Школьные оценки</Table.Td><Table.Td>{gpaText}</Table.Td></Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>

          {view === 'table' && (
          <Paper withBorder radius="sm" p="md">
            <Group justify="space-between" mb="sm">
              <Text fw={700}>5. Статус поступления</Text>
              <Group gap="xs">
                <SegmentedControl size="xs" value={view} onChange={(v) => setView(v as 'table' | 'kanban')} data={[{ value: 'table', label: 'Таблица' }, { value: 'kanban', label: 'Канбан' }]} />
                <Button size="xs" variant="light" onClick={() => setAppOpen(true)}>+ Вуз</Button>
              </Group>
            </Group>
            <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr><Table.Th>Университет</Table.Th><Table.Th>Страна</Table.Th><Table.Th>Программа</Table.Th><Table.Th>Статус</Table.Th></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {profile.applications.map((app) => (
                    <Table.Tr key={app.id}>
                      <Table.Td>{app.universityName}</Table.Td>
                      <Table.Td>{app.country || '—'}</Table.Td>
                      <Table.Td>{app.program || '—'}</Table.Td>
                      <Table.Td><Badge radius="sm" variant="light" style={{ whiteSpace: 'nowrap' }}>{CC_ADMISSION_STATUS_LABELS[app.admissionStatus] ?? app.admissionStatus}</Badge></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
            </Table>
          </Paper>
          )}
        </Stack>

        <Stack gap="md">
          <Paper withBorder radius="sm" p="md">
            <Group gap="xs" mb="sm"><IconFlag size={18} /><Text fw={700}>2. Ожидания родителей</Text></Group>
            <Text size="sm"><b>Страны:</b> {profile.parentCountries.join(', ') || '—'}</Text>
            <Text size="sm"><b>Бюджет:</b> {profile.parentBudgetUsd == null ? '—' : `$${profile.parentBudgetUsd}`}</Text>
            <Text size="sm"><b>Major:</b> {profile.parentMajor || '—'}</Text>
            <Text size="sm"><b>Безопасность:</b> {profile.parentSafety ? 'критична' : 'обычно'}</Text>
            <Text size="sm" mt="xs">{profile.parentExpectations || 'Ожидания не заполнены'}</Text>
          </Paper>

          <Paper withBorder radius="sm" p="md">
            <Group gap="xs" mb="sm"><IconFileText size={18} /><Text fw={700}>4. Документы</Text></Group>
            <Stack gap="xs">
              {profile.documents.map((doc) => (
                <Group key={doc.id} justify="space-between" wrap="nowrap">
                  <div>
                    <Text size="sm" fw={600}>{CC_DOC_TYPE_LABELS[doc.docType as keyof typeof CC_DOC_TYPE_LABELS] ?? doc.docType}</Text>
                    <Text size="xs" c="dimmed">{doc.comment || fmtDate(doc.requestedDeadline)}</Text>
                  </div>
                  <Badge color={DOC_STATUS_COLOR[doc.status] ?? 'gray'} variant="light" radius="sm" style={{ whiteSpace: 'nowrap' }}>{CC_DOC_STATUS_LABELS[doc.status as keyof typeof CC_DOC_STATUS_LABELS] ?? doc.status}</Badge>
                </Group>
              ))}
              {profile.documents.length === 0 && <Text size="sm" c="dimmed">Документы ещё не заведены</Text>}
            </Stack>
          </Paper>
        </Stack>

        <Stack gap="md">
          <Paper withBorder radius="sm" p="md">
            <Text fw={700} mb="sm">7. Ближайшие дедлайны</Text>
            <Stack gap="xs">
              {profile.deadlines.slice(0, 8).map((rawDeadline) => {
                const deadline = { ...rawDeadline, title: deadlineTitle(rawDeadline) };
                return (
                  <Group key={`${deadline.type}-${deadline.id}`} justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" fw={600}>{fmtDate(deadline.date)} · {deadline.title}</Text>
                      <Text size="xs" c="dimmed">{deadlineCategory(deadline)}</Text>
                    </div>
                    <Badge color={daysColor(deadline.daysLeft)} variant="light" radius="sm" style={{ whiteSpace: 'nowrap' }}>{deadline.daysLeft >= 0 ? `${deadline.daysLeft} дн.` : 'просрочено'}</Badge>
                  </Group>
                );
              })}
              {profile.deadlines.length === 0 && <Text size="sm" c="dimmed">Нет дедлайнов</Text>}
            </Stack>
          </Paper>

          <Paper withBorder radius="sm" p="md">
            <Group justify="space-between" mb="sm">
              <Group gap="xs"><IconMessageCircle size={18} /><Text fw={700}>6. Журнал встреч</Text></Group>
              <Button size="xs" variant="light" onClick={() => setMeetingOpen(true)}>+ встреча</Button>
            </Group>
            <Stack gap="xs">
              {profile.meetings.map((meeting) => (
                <Paper key={meeting.id} withBorder radius="sm" p="xs">
                  <Text size="sm" fw={600}>{fmtDate(meeting.meetingDate)} · {meeting.topic || 'Встреча'}</Text>
                  <Text size="xs" c="dimmed">{meeting.format || 'формат не указан'}</Text>
                  {meeting.actionItems && <Text size="sm" mt={4}>{meeting.actionItems}</Text>}
                </Paper>
              ))}
              {profile.meetings.length === 0 && <Text size="sm" c="dimmed">Встреч ещё нет</Text>}
            </Stack>
          </Paper>
        </Stack>

        {view === 'kanban' && (
          <Paper withBorder radius="sm" p="md" style={{ gridColumn: '1 / -1' }}>
            <Group justify="space-between" mb="sm">
              <Text fw={700}>5. Статус поступления</Text>
              <Group gap="xs">
                <SegmentedControl size="xs" value={view} onChange={(v) => setView(v as 'table' | 'kanban')} data={[{ value: 'table', label: 'Таблица' }, { value: 'kanban', label: 'Канбан' }]} />
                <Button size="xs" variant="light" onClick={() => setAppOpen(true)}>+ Вуз</Button>
              </Group>
            </Group>
            <CcPipelineKanban applications={profile.applications} queryKey={['cc-profile', id]} />
          </Paper>
        )}
      </SimpleGrid>

      <ProfileEditModal profile={profile} opened={editOpen} onClose={() => setEditOpen(false)} />
      <AddApplicationModal profileId={profile.id} opened={appOpen} onClose={() => setAppOpen(false)} />
      <AddMeetingModal profileId={profile.id} opened={meetingOpen} onClose={() => setMeetingOpen(false)} />
    </Stack>
  );
}

export default function CcProfilePage() {
  return (
    <RoleGate roles={[...CC_ROLES]}>
      <CcProfileCard />
    </RoleGate>
  );
}
