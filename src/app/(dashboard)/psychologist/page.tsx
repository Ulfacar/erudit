'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert, Badge, Button, Card, Group, Loader, Modal, Paper, Select, SimpleGrid, Stack, Text,
  Textarea, TextInput, Title,
} from '@mantine/core';
import { IconBrain, IconUserPlus, IconAlertTriangle, IconActivity, IconFlame, IconClipboardHeart } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { fmtDate } from '@/shared/components/ui/resource-helpers';
import { DrilldownByClass, type DrillGroup } from '@/shared/components/DrilldownByClass';

const RISK = {
  green: { label: 'Зелёный', color: 'green', rank: 0 },
  yellow: { label: 'Жёлтый', color: 'yellow', rank: 1 },
  red: { label: 'Красный', color: 'red', rank: 2 },
} as const;
const STATUS = {
  new: { label: 'Новый', color: 'gray' },
  in_progress: { label: 'В работе', color: 'blue' },
  paused: { label: 'Приостановлен', color: 'orange' },
  closed: { label: 'Закрыт', color: 'teal' },
} as const;

interface Student { id: string; firstName: string; lastName: string; middleName?: string | null; class?: { grade: number; letter: string } | null }
interface PsyCase {
  id: string; studentId: string; title: string; riskLevel: keyof typeof RISK;
  status: keyof typeof STATUS; updatedAt: string; isIntake?: boolean; _count?: { sessions: number };
}
interface ActiveCase { id: string; ownerName: string; isMine: boolean; riskLevel: keyof typeof RISK }

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group gap="xs" mb={4}>{icon}<Text size="xs" c="dimmed" tt="uppercase">{label}</Text></Group>
      <Text fw={700} size="xl" c={color}>{value}</Text>
    </Paper>
  );
}

function PsychologistCabinet() {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<PsyCase[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);
  const [studentModal, setStudentModal] = useState<{ name: string; cases: PsyCase[] } | null>(null);

  // форма создания
  const [studentId, setStudentId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [risk, setRisk] = useState<keyof typeof RISK>('green');
  const [justification, setJustification] = useState('');
  const [active, setActive] = useState<ActiveCase[]>([]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const studentInfo = useMemo(() => {
    const m: Record<string, { name: string; className: string }> = {};
    for (const s of students) {
      m[s.id] = {
        name: `${s.lastName} ${s.firstName}${s.middleName ? ' ' + s.middleName : ''}`,
        className: s.class ? `${s.class.grade}${s.class.letter}` : 'Без класса',
      };
    }
    return m;
  }, [students]);

  async function load() {
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

  // Дашборд «моя работа»
  const inRisk = cases.filter((c) => c.riskLevel !== 'green' && c.status !== 'closed').length;
  const critical = cases.filter((c) => c.riskLevel === 'red' && c.status !== 'closed').length;
  const sessions = cases.reduce((s, c) => s + (c._count?.sessions ?? 0), 0);
  const openCount = cases.filter((c) => c.status !== 'closed').length;

  // Группировка кейсов по классам → ученики → их кейсы
  const groups = useMemo<DrillGroup[]>(() => {
    const byClass = new Map<string, PsyCase[]>();
    for (const c of cases) {
      const cls = studentInfo[c.studentId]?.className ?? 'Без класса';
      if (!byClass.has(cls)) byClass.set(cls, []);
      byClass.get(cls)!.push(c);
    }
    const worst = (list: PsyCase[]) => list.reduce((m, c) => Math.max(m, RISK[c.riskLevel].rank), 0);
    const riskColor = (rank: number) => (rank === 2 ? 'red' : rank === 1 ? 'yellow' : 'green');

    return [...byClass.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
      .map(([cls, list]) => {
        // уникальные ученики класса
        const byStudent = new Map<string, PsyCase[]>();
        for (const c of list) {
          if (!byStudent.has(c.studentId)) byStudent.set(c.studentId, []);
          byStudent.get(c.studentId)!.push(c);
        }
        const open = list.filter((c) => c.status !== 'closed').length;
        return {
          key: cls, title: cls,
          count: open, countColor: riskColor(worst(list.filter((c) => c.status !== 'closed'))),
          subtitle: `${byStudent.size} ученик(ов) · открытых ${open}`,
          items: [...byStudent.entries()].map(([sid, sCases]) => {
            const info = studentInfo[sid];
            const w = worst(sCases);
            return {
              id: sid,
              primary: info?.name ?? '—',
              secondary: `${sCases.length} кейс(ов)`,
              right: <Badge color={riskColor(w)} variant="light">{RISK[(['green', 'yellow', 'red'] as const)[w]].label}</Badge>,
              onClick: () => setStudentModal({ name: info?.name ?? '—', cases: sCases }),
            };
          }),
        };
      });
  }, [cases, studentInfo]);

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

      {/* Моя работа */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatCard icon={<IconActivity size={15} color="#1971c2" />} label="Открытых кейсов" value={String(openCount)} color="#1971c2" />
        <StatCard icon={<IconAlertTriangle size={15} color="#f08c00" />} label="В зоне риска" value={String(inRisk)} color="#f08c00" />
        <StatCard icon={<IconFlame size={15} color="#e03131" />} label="Критических" value={String(critical)} color="#e03131" />
        <StatCard icon={<IconClipboardHeart size={15} color="#2f9e44" />} label="Консультаций" value={String(sessions)} color="#2f9e44" />
      </SimpleGrid>

      <Group gap="xs">
        {Object.entries(RISK).map(([k, v]) => <Badge key={k} color={v.color} variant="light">{v.label}</Badge>)}
      </Group>

      <Paper withBorder p="md" radius="md">
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : (
          <DrilldownByClass groups={groups} emptyText="Пока нет кейсов. Создайте первый — «Новый кейс»." />
        )}
      </Paper>

      {/* Кейсы выбранного ученика */}
      <Modal opened={!!studentModal} onClose={() => setStudentModal(null)} title={`Кейсы — ${studentModal?.name ?? ''}`} centered size="lg">
        <Stack gap="sm">
          {studentModal?.cases.map((c) => (
            <Card key={c.id} withBorder radius="md" padding="sm" component={Link} href={`/psychologist/cases/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  <Text fw={500}>{c.title}</Text>
                  {c.isIntake && <Badge size="xs" color="grape" variant="light">входная диагностика</Badge>}
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Badge color={RISK[c.riskLevel].color} variant="light">{RISK[c.riskLevel].label}</Badge>
                  <Badge color={STATUS[c.status].color} variant="outline">{STATUS[c.status].label}</Badge>
                  <Text size="xs" c="dimmed">{c._count?.sessions ?? 0} сесс. · {fmtDate(c.updatedAt)}</Text>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      </Modal>

      <Modal opened={open} onClose={() => setOpen(false)} title="Новый кейс" centered size="lg">
        <Stack gap="md">
          <Select
            label="Ученик" placeholder="Найти ученика" searchable required
            data={students.map((s) => ({ value: s.id, label: `${s.lastName} ${s.firstName}${s.class ? ` (${s.class.grade}${s.class.letter})` : ''}` }))}
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
