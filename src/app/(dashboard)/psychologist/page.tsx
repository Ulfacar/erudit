'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert, Badge, Button, Group, Loader, Modal, Paper, Select, Stack, Table, Text,
  Textarea, TextInput, Title,
} from '@mantine/core';
import { IconBrain, IconUserPlus, IconAlertTriangle } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

const RISK = {
  green: { label: 'Зелёный', color: 'green' },
  yellow: { label: 'Жёлтый', color: 'yellow' },
  red: { label: 'Красный', color: 'red' },
} as const;
const STATUS = {
  new: { label: 'Новый', color: 'gray' },
  in_progress: { label: 'В работе', color: 'blue' },
  paused: { label: 'Приостановлен', color: 'orange' },
  closed: { label: 'Закрыт', color: 'teal' },
} as const;

interface Student { id: string; firstName: string; lastName: string; middleName?: string | null }
interface PsyCase {
  id: string; studentId: string; title: string; riskLevel: keyof typeof RISK;
  status: keyof typeof STATUS; updatedAt: string; isIntake?: boolean; _count?: { sessions: number };
}
interface ActiveCase { id: string; ownerName: string; isMine: boolean; riskLevel: keyof typeof RISK }

function PsychologistCabinet() {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<PsyCase[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);

  // форма создания
  const [studentId, setStudentId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [risk, setRisk] = useState<keyof typeof RISK>('green');
  const [justification, setJustification] = useState('');
  const [active, setActive] = useState<ActiveCase[]>([]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const studentMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of students) m[s.id] = `${s.lastName} ${s.firstName}${s.middleName ? ' ' + s.middleName : ''}`;
    return m;
  }, [students]);

  async function load() {
    setLoading(true);
    const [cRes, sRes] = await Promise.all([
      fetch('/api/v1/psy/cases').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/students').then((r) => r.json()).catch(() => ({ data: [] })),
    ]);
    setCases(cRes.data ?? []);
    setStudents(sRes.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // при выборе ученика — проверяем активные кейсы (UC-1)
  useEffect(() => {
    if (!studentId) { setActive([]); return; }
    fetch(`/api/v1/psy/cases/active?studentId=${studentId}`)
      .then((r) => r.json()).then((j) => setActive(j.data ?? [])).catch(() => setActive([]));
  }, [studentId]);

  function resetForm() {
    setStudentId(null); setTitle(''); setReason(''); setRisk('green'); setJustification(''); setActive([]); setErr('');
  }

  async function create() {
    setErr('');
    if (!studentId || !title.trim()) { setErr('Выберите ученика и укажите название'); return; }
    if (risk === 'red' && !justification.trim()) { setErr('Для красного риска нужно обоснование'); return; }
    setSaving(true);
    const res = await fetch('/api/v1/psy/cases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, title, reason, riskLevel: risk, riskJustification: justification }),
    });
    const j = await res.json();
    setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    setOpen(false); resetForm(); load();
  }

  async function requestCollab(caseId: string) {
    await fetch(`/api/v1/psy/cases/${caseId}/collaborators`, { method: 'POST' });
    setErr('Запрос со-терапевтического доступа отправлен владельцу кейса.');
  }

  const foreignActive = active.filter((a) => !a.isMine);

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconBrain size={26} color="#9c36b5" />
          <Title order={2}>Кабинет психолога</Title>
        </Group>
        <Button leftSection={<IconUserPlus size={16} />} onClick={() => { resetForm(); setOpen(true); }}>
          Новый кейс
        </Button>
      </Group>

      <Group gap="xs">
        {Object.entries(RISK).map(([k, v]) => <Badge key={k} color={v.color} variant="light">{v.label}</Badge>)}
      </Group>

      <Paper withBorder p="md" radius="md">
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : cases.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">Пока нет кейсов. Создайте первый — «Новый кейс».</Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ученик</Table.Th><Table.Th>Кейс</Table.Th><Table.Th>Риск</Table.Th>
                <Table.Th>Статус</Table.Th><Table.Th>Сессий</Table.Th><Table.Th>Обновлён</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cases.map((c) => (
                <Table.Tr key={c.id} style={{ cursor: 'pointer' }}>
                  <Table.Td><Link href={`/psychologist/cases/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>{studentMap[c.studentId] ?? '—'}</Link></Table.Td>
                  <Table.Td>
                    <Link href={`/psychologist/cases/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <Group gap={6} wrap="nowrap">
                        {c.title}
                        {c.isIntake && <Badge size="xs" color="grape" variant="light">входная диагностика</Badge>}
                      </Group>
                    </Link>
                  </Table.Td>
                  <Table.Td><Badge color={RISK[c.riskLevel].color} variant="light">{RISK[c.riskLevel].label}</Badge></Table.Td>
                  <Table.Td><Badge color={STATUS[c.status].color} variant="outline">{STATUS[c.status].label}</Badge></Table.Td>
                  <Table.Td>{c._count?.sessions ?? 0}</Table.Td>
                  <Table.Td>{fmtDate(c.updatedAt)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal opened={open} onClose={() => setOpen(false)} title="Новый кейс" centered size="lg">
        <Stack gap="md">
          <Select
            label="Ученик" placeholder="Найти ученика" searchable required
            data={students.map((s) => ({ value: s.id, label: `${s.lastName} ${s.firstName}` }))}
            value={studentId} onChange={setStudentId}
          />
          {foreignActive.length > 0 && (
            <Alert color="orange" icon={<IconAlertTriangle size={16} />} title="Ученик уже в работе">
              <Stack gap="xs">
                {foreignActive.map((a) => (
                  <Group key={a.id} justify="space-between">
                    <Text size="sm">У коллеги <b>{a.ownerName}</b> (риск: {RISK[a.riskLevel].label})</Text>
                    <Button size="xs" variant="light" onClick={() => requestCollab(a.id)}>Запросить со-доступ</Button>
                  </Group>
                ))}
              </Stack>
            </Alert>
          )}
          <TextInput label="Название кейса" placeholder="Напр.: адаптация, тревожность" required value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          <Textarea label="Причина обращения" autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Select
            label="Стартовый уровень риска" required
            data={Object.entries(RISK).map(([k, v]) => ({ value: k, label: v.label }))}
            value={risk} onChange={(v) => setRisk((v as keyof typeof RISK) ?? 'green')}
          />
          {risk === 'red' && (
            <Textarea
              label="Обоснование критического риска" required autosize minRows={2}
              description="Обязательно. Сгенерирует слепое safeguarding-уведомление координатору."
              value={justification} onChange={(e) => setJustification(e.currentTarget.value)}
            />
          )}
          {err && <Text c="red" size="sm">{err}</Text>}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={create} loading={saving}>Создать кейс</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function PsychologistPage() {
  return (
    <RoleGate roles={['psychologist', 'senior_psychologist', 'specialist', 'super_admin']}>
      <PsychologistCabinet />
    </RoleGate>
  );
}
