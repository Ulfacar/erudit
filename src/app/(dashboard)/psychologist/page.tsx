'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Button, Card, Group, Loader, Paper, SegmentedControl, SimpleGrid, Stack, Text, Title, Tooltip,
} from '@mantine/core';
import Link from 'next/link';
import { IconBrain, IconUserPlus, IconAlertTriangle, IconActivity, IconFlame, IconClipboardHeart, IconClipboardCheck } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { DrilldownByClass, type DrillGroup } from '@/shared/components/DrilldownByClass';
import { StudentPsyCard } from './StudentPsyCard';
import { SubjectPsyCard } from './SubjectPsyCard';
import { NewPsyCaseModal, type SubjectType } from './NewPsyCaseModal';

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

const CABINETS: { value: SubjectType; label: string }[] = [
  { value: 'student', label: 'Ученики' },
  { value: 'parent', label: 'Родители' },
  { value: 'group', label: 'Группы' },
  { value: 'teacher', label: 'Учителя' },
];

interface PsyCase {
  id: string; subjectType: SubjectType; studentId: string | null; subjectId: string | null; subjectName: string | null;
  subjectDisplay: string; className?: string | null;
  title: string; riskLevel: keyof typeof RISK; status: keyof typeof STATUS; updatedAt: string; isIntake?: boolean; docOverdue?: boolean; _count?: { sessions: number };
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group gap="xs" mb={4}>{icon}<Text size="xs" c="dimmed" tt="uppercase">{label}</Text></Group>
      <Text fw={700} size="xl" c={color}>{value}</Text>
    </Paper>
  );
}

function DocOverdueBadge() {
  return (
    <Tooltip label="Документация не подтверждена в срок">
      <Badge color="red" variant="filled" size="sm">!</Badge>
    </Tooltip>
  );
}

const worstRank = (list: PsyCase[]) => list.reduce((m, c) => Math.max(m, RISK[c.riskLevel].rank), 0);
const riskColor = (rank: number) => (rank === 2 ? 'red' : rank === 1 ? 'yellow' : 'green');

function PsychologistCabinet() {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<PsyCase[]>([]);
  const [cabinet, setCabinet] = useState<SubjectType>('student');
  const [open, setOpen] = useState(false);
  const [cardStudentId, setCardStudentId] = useState<string | null>(null);
  const [cardSubject, setCardSubject] = useState<{ type: 'parent' | 'teacher'; id: string; name: string } | null>(null);

  const studentInfo = useMemo(() => {
    const m: Record<string, { name: string; className: string }> = {};
    for (const c of cases) {
      if (!c.studentId) continue;
      m[c.studentId] = {
        name: c.subjectDisplay,
        className: c.className ?? 'Без класса',
      };
    }
    return m;
  }, [cases]);

  async function load() {
    const cRes = await fetch('/api/v1/psy/cases').then((r) => r.json()).catch(() => ({ data: [] }));
    setCases(cRes.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Дашборд «моя работа» — по всем кабинетам
  const inRisk = cases.filter((c) => c.riskLevel !== 'green' && c.status !== 'closed').length;
  const critical = cases.filter((c) => c.riskLevel === 'red' && c.status !== 'closed').length;
  const sessions = cases.reduce((s, c) => s + (c._count?.sessions ?? 0), 0);
  const openCount = cases.filter((c) => c.status !== 'closed').length;
  const emergencyCases = useMemo(() => cases.filter((c) => c.riskLevel === 'red' && c.status !== 'closed'), [cases]);

  // Кейсы текущего кабинета
  const cabinetCases = useMemo(() => cases.filter((c) => c.subjectType === cabinet), [cases, cabinet]);

  // Ученики: группировка по классам → ученики → кейсы
  const studentGroups = useMemo<DrillGroup[]>(() => {
    const byClass = new Map<string, PsyCase[]>();
    for (const c of cabinetCases) {
      const cls = studentInfo[c.studentId ?? '']?.className ?? 'Без класса';
      if (!byClass.has(cls)) byClass.set(cls, []);
      byClass.get(cls)!.push(c);
    }
    return [...byClass.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
      .map(([cls, list]) => {
        const byStudent = new Map<string, PsyCase[]>();
        for (const c of list) {
          const sid = c.studentId ?? '';
          if (!byStudent.has(sid)) byStudent.set(sid, []);
          byStudent.get(sid)!.push(c);
        }
        const open = list.filter((c) => c.status !== 'closed').length;
        return {
          key: cls, title: cls,
          count: open, countColor: riskColor(worstRank(list.filter((c) => c.status !== 'closed'))),
          subtitle: `${byStudent.size} ученик(ов) · открытых ${open}`,
          items: [...byStudent.entries()].map(([sid, sCases]) => {
            const info = studentInfo[sid];
            const w = worstRank(sCases);
            const hasDocOverdue = sCases.some((c) => c.docOverdue);
            return {
              id: sid,
              primary: info?.name ?? '—',
              secondary: `${sCases.length} кейс(ов)`,
              right: (
                <Group gap={4} wrap="nowrap">
                  {hasDocOverdue && <DocOverdueBadge />}
                  <Badge color={riskColor(w)} variant="light">{RISK[(['green', 'yellow', 'red'] as const)[w]].label}</Badge>
                </Group>
              ),
              onClick: () => setCardStudentId(sid),
            };
          }),
        };
      });
  }, [cabinetCases, studentInfo]);

  // Родители/Учителя/Группы: плоская группировка по субъекту → кейсы
  const subjectGroups = useMemo(() => {
    const m = new Map<string, { name: string; list: PsyCase[] }>();
    for (const c of cabinetCases) {
      const key = c.subjectId ?? c.id;
      if (!m.has(key)) m.set(key, { name: c.subjectDisplay, list: [] });
      m.get(key)!.list.push(c);
    }
    return [...m.entries()].map(([id, value]) => ({ id, ...value })).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [cabinetCases]);

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconBrain size={26} color="#9c36b5" />
          <Title order={2}>Кабинет психолога</Title>
        </Group>
        <Group gap="xs">
          <Button component={Link} href="/psychologist/intake" variant="light" leftSection={<IconClipboardCheck size={16} />}>
            Приём
          </Button>
          <Button leftSection={<IconUserPlus size={16} />} onClick={() => setOpen(true)}>
            Открыть кейс
          </Button>
        </Group>
      </Group>

      {emergencyCases.length > 0 && (
        <Paper withBorder radius="md" p="md" bg="red.0" style={{ borderColor: 'var(--mantine-color-red-4)' }}>
          <Stack gap="sm">
            <Group gap="xs">
              <Text fw={700} c="red.8">⚠ Экстренные обращения</Text>
              <Badge color="red" variant="filled">{emergencyCases.length}</Badge>
            </Group>
            <Stack gap={6}>
              {emergencyCases.map((c) => (
                <Card
                  key={c.id}
                  withBorder
                  radius="sm"
                  padding="sm"
                  component={Link}
                  href={`/psychologist/cases/${c.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', borderColor: 'var(--mantine-color-red-3)' }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text fw={600}>{c.title}</Text>
                      <Text size="sm" c="dimmed">{c.subjectDisplay}</Text>
                    </div>
                    <Badge color="red" variant="filled">Красный</Badge>
                  </Group>
                </Card>
              ))}
            </Stack>
          </Stack>
        </Paper>
      )}

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatCard icon={<IconActivity size={15} color="#1971c2" />} label="Открытых кейсов" value={String(openCount)} color="#1971c2" />
        <StatCard icon={<IconAlertTriangle size={15} color="#f08c00" />} label="В зоне риска" value={String(inRisk)} color="#f08c00" />
        <StatCard icon={<IconFlame size={15} color="#e03131" />} label="Критических" value={String(critical)} color="#e03131" />
        <StatCard icon={<IconClipboardHeart size={15} color="#2f9e44" />} label="Консультаций" value={String(sessions)} color="#2f9e44" />
      </SimpleGrid>

      <SegmentedControl
        value={cabinet}
        onChange={(v) => setCabinet(v as SubjectType)}
        data={CABINETS}
        fullWidth
      />

      <Paper withBorder p="md" radius="md">
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : cabinet === 'student' ? (
          <DrilldownByClass groups={studentGroups} emptyText="Пока нет кейсов по ученикам. Создайте первый — «Открыть кейс»." />
        ) : subjectGroups.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">Пока нет кейсов в этом кабинете. Создайте первый — «Открыть кейс».</Text>
        ) : (
          <Stack gap="md">
            {subjectGroups.map((g) => (
              <div key={g.id}>
                <Group gap="xs" mb={6}>
                  <Text fw={600}>{g.name}</Text>
                  {(cabinet === 'parent' || cabinet === 'teacher') && (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => setCardSubject({ type: cabinet, id: g.id, name: g.name })}
                    >
                      Карточка
                    </Button>
                  )}
                  <Badge variant="light" color={riskColor(worstRank(g.list.filter((c) => c.status !== 'closed')))}>
                    открытых {g.list.filter((c) => c.status !== 'closed').length}
                  </Badge>
                </Group>
                <Stack gap={6}>
                  {g.list.map((c) => (
                    <Card key={c.id} withBorder radius="sm" padding="sm" component={Link} href={`/psychologist/cases/${c.id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}>
                      <Group justify="space-between" wrap="nowrap">
                        <Text fw={500}>{c.title}</Text>
                        <Group gap="xs" wrap="nowrap">
                          {c.docOverdue && <DocOverdueBadge />}
                          <Badge color={RISK[c.riskLevel].color} variant="light">{RISK[c.riskLevel].label}</Badge>
                          <Badge color={STATUS[c.status].color} variant="outline">{STATUS[c.status].label}</Badge>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </div>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Анкета выбранного ученика */}
      <StudentPsyCard studentId={cardStudentId} onClose={() => setCardStudentId(null)} onChanged={load} />
      <SubjectPsyCard
        subjectType={cardSubject?.type ?? null}
        subjectId={cardSubject?.id ?? null}
        subjectName={cardSubject?.name ?? ''}
        onClose={() => setCardSubject(null)}
      />

      <NewPsyCaseModal
        opened={open}
        subjectType={cabinet}
        onClose={() => setOpen(false)}
        onCreated={() => { setOpen(false); load(); }}
      />
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
