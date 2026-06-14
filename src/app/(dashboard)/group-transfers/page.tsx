'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { IconArrowsExchange, IconPlus } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

/* ── Types ── */
interface Transfer {
  id: string;
  studentId: string;
  classId: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason: string | null;
  createdAt: string;
  fromGroup: { id: string; name: string };
  toGroup: { id: string; name: string };
}
interface Student {
  id: string;
  firstName: string;
  lastName: string;
  class?: { grade: number; letter: string } | null;
}
interface ClassRow { id: string; grade: number; letter: string }
interface ClassGroup { id: string; name: string; _count?: { students: number } }
interface ClassDetail {
  students: { id: string; firstName: string; lastName: string }[];
  groups: ClassGroup[];
}

const STATUS_META: Record<Transfer['status'], { label: string; color: string }> = {
  pending: { label: 'На рассмотрении', color: 'yellow' },
  approved: { label: 'Одобрен', color: 'green' },
  rejected: { label: 'Отклонён', color: 'red' },
};

function GroupTransfers() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [list, setList] = useState<Transfer[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // create modal
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [fromGroupId, setFromGroupId] = useState<string | null>(null);
  const [toGroupId, setToGroupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // reject modal
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, s, c] = await Promise.all([
      fetch('/api/v1/groups/transfers').then((r) => r.json()).catch(() => ({})),
      fetch('/api/v1/students').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/classes').then((r) => r.json()).catch(() => ({ data: [] })),
    ]);
    setList(t.data?.transfers ?? []);
    setMonthlyLimit(t.data?.monthlyLimit ?? null);
    setStudents(s.data ?? []);
    setClasses(c.data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // load class detail (groups + students) when class chosen in modal
  useEffect(() => {
    if (!classId) { setDetail(null); return; }
    setDetailLoading(true);
    setStudentId(null); setFromGroupId(null); setToGroupId(null);
    fetch(`/api/v1/classes/${classId}`)
      .then((r) => r.json())
      .then((j) => setDetail({ students: j.data?.students ?? [], groups: j.data?.groups ?? [] }))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [classId]);

  const studentName = (id: string) => {
    const s = students.find((x) => x.id === id);
    return s ? `${s.lastName} ${s.firstName}` : '—';
  };
  const classLabel = (id: string) => {
    const c = classes.find((x) => x.id === id);
    return c ? `${c.grade}${c.letter}` : '—';
  };

  function resetCreate() {
    setOpen(false); setClassId(null); setDetail(null);
    setStudentId(null); setFromGroupId(null); setToGroupId(null); setErr('');
  }

  async function submit() {
    if (!classId || !studentId || !fromGroupId || !toGroupId) {
      setErr('Заполните класс, ученика и обе группы'); return;
    }
    if (fromGroupId === toGroupId) { setErr('Группы должны различаться'); return; }
    if (!currentUserId) { setErr('Не удалось определить пользователя'); return; }
    setSaving(true); setErr('');
    const res = await fetch('/api/v1/groups/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, classId, fromGroupId, toGroupId, requestedBy: currentUserId }),
    });
    const j = await res.json(); setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    resetCreate(); load();
  }

  async function approve(id: string) {
    if (!currentUserId) return;
    setActing(true);
    const res = await fetch(`/api/v1/groups/transfers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', approvedBy: currentUserId }),
    });
    const j = await res.json(); setActing(false);
    if (!j.success) { alert(j.error?.message ?? 'Не удалось одобрить'); return; }
    load();
  }

  async function reject() {
    if (!rejectId) return;
    setActing(true);
    const res = await fetch(`/api/v1/groups/transfers/${rejectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason: rejectReason || undefined }),
    });
    const j = await res.json(); setActing(false);
    setRejectId(null); setRejectReason('');
    if (!j.success) { alert(j.error?.message ?? 'Не удалось отклонить'); return; }
    load();
  }

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconArrowsExchange size={26} color="#1971c2" />
          <Title order={2}>Переводы между группами</Title>
        </Group>
        <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setOpen(true)}>
          Запросить перевод
        </Button>
      </Group>
      <Text c="dimmed" size="sm">
        Перевод ученика между группами одного класса. Требует подтверждения принимающей стороны.
        {monthlyLimit != null && ` Лимит — ${monthlyLimit} одобренных переводов на класс в месяц.`}
      </Text>

      <Paper withBorder p="md" radius="md">
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : list.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">Запросов на перевод нет.</Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ученик</Table.Th>
                <Table.Th>Класс</Table.Th>
                <Table.Th>Перевод</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th>Дата</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>{studentName(t.studentId)}</Table.Td>
                  <Table.Td>{classLabel(t.classId)}</Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm">{t.fromGroup?.name}</Text>
                      <IconArrowsExchange size={14} color="#868e96" />
                      <Text size="sm" fw={500}>{t.toGroup?.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_META[t.status].color} variant="light">
                      {STATUS_META[t.status].label}
                    </Badge>
                    {t.status === 'rejected' && t.rejectReason && (
                      <Text size="xs" c="dimmed" mt={2}>{t.rejectReason}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>{fmtDate(t.createdAt)}</Table.Td>
                  <Table.Td>
                    {t.status === 'pending' && (
                      <Group gap={6} justify="flex-end" wrap="nowrap">
                        <Button size="xs" color="green" variant="light" loading={acting}
                          onClick={() => approve(t.id)}>Одобрить</Button>
                        <Button size="xs" color="red" variant="subtle"
                          onClick={() => { setRejectId(t.id); setRejectReason(''); }}>Отклонить</Button>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Create request */}
      <Modal opened={open} onClose={resetCreate} title="Запрос на перевод между группами" centered>
        <Stack gap="md">
          <Select
            label="Класс" placeholder="Выберите класс" searchable required
            value={classId} onChange={setClassId}
            data={classes.map((c) => ({ value: c.id, label: `${c.grade}${c.letter}` }))}
          />
          {detailLoading && <Group justify="center"><Loader size="sm" /></Group>}
          {detail && (
            <>
              <Select
                label="Ученик" placeholder="Выберите ученика" searchable required
                value={studentId} onChange={setStudentId}
                data={detail.students.map((s) => ({ value: s.id, label: `${s.lastName} ${s.firstName}` }))}
              />
              <Group grow align="flex-end">
                <Select
                  label="Из группы" placeholder="Группа" required
                  value={fromGroupId} onChange={setFromGroupId}
                  data={detail.groups.map((g) => ({ value: g.id, label: g.name }))}
                />
                <Select
                  label="В группу" placeholder="Группа" required
                  value={toGroupId} onChange={setToGroupId}
                  data={detail.groups
                    .filter((g) => g.id !== fromGroupId)
                    .map((g) => ({ value: g.id, label: g.name }))}
                />
              </Group>
              {detail.groups.length < 2 && (
                <Text size="xs" c="orange">В классе меньше двух групп — переводить некуда.</Text>
              )}
            </>
          )}
          {err && <Text c="red" size="sm">{err}</Text>}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={resetCreate}>Отмена</Button>
            <Button onClick={submit} loading={saving}>Запросить</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Reject reason */}
      <Modal opened={!!rejectId} onClose={() => setRejectId(null)} title="Отклонить перевод" centered>
        <Stack gap="md">
          <Textarea
            label="Причина (необязательно)" autosize minRows={2}
            value={rejectReason} onChange={(e) => setRejectReason(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setRejectId(null)}>Отмена</Button>
            <Button color="red" onClick={reject} loading={acting}>Отклонить</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function GroupTransfersPage() {
  return (
    <RoleGate roles={['super_admin', 'zavuch', 'teacher', 'curator']}>
      <GroupTransfers />
    </RoleGate>
  );
}
