'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalendar,
  IconCalendarStats,
  IconCash,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconMessageDots,
  IconMoodEmpty,
  IconNotebook,
  IconStar,
} from '@tabler/icons-react';
import { useMe } from '@/shared/hooks/useMe';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { noteTypeInfo } from '@/shared/lib/note-types';
import { INV_COLOR, invoiceStatusLabel } from '@/shared/lib/finance/invoice-status';

/* ── Заметки (BehaviorIncident, EduPage-style) ── */
interface NoteItem { id: string; type: string; description: string; status: string; createdAt: string }

function NotesTab({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<NoteItem[] | null>(null);
  useEffect(() => {
    setItems(null);
    fetch(`/api/v1/students/${studentId}/incidents`)
      .then((r) => r.json())
      .then((j) => setItems(j.success ? j.data : []))
      .catch(() => setItems([]));
  }, [studentId]);

  if (!items) return <Center py="lg"><Loader size="sm" /></Center>;
  if (items.length === 0) {
    return (
      <Paper withBorder p="lg" radius="md" ta="center">
        <ThemeIcon variant="light" color="teal" size={44} radius="xl" mx="auto"><IconCheck size={24} /></ThemeIcon>
        <Text mt="sm" c="dimmed">Заметок от учителей нет — отличная новость!</Text>
      </Paper>
    );
  }
  return (
    <Stack gap="sm">
      {items.map((i) => {
        const info = noteTypeInfo(i.type);
        return (
          <Paper key={i.id} withBorder p="sm" radius="md" style={{ borderLeft: `4px solid var(--mantine-color-${info.color}-5)` }}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Group gap={10} wrap="nowrap" align="flex-start">
                <Text style={{ fontSize: 22 }}>{info.emoji}</Text>
                <div>
                  <Text size="sm" fw={600}>{info.label}</Text>
                  {i.description && i.description !== info.label && (
                    <Text size="xs" c="dimmed" mt={2}>{i.description}</Text>
                  )}
                </div>
              </Group>
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {new Date(i.createdAt).toLocaleDateString('ru-RU')}
              </Text>
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
}

/* ── Оплата (счета ребёнка, пеня на сервере) ── */
interface MyInvoice {
  id: string; studentId: string; title: string; period: string | null;
  amount: number; status: string; dueDate: string | null;
  paid: number; remaining: number; penalty: number; overdueDays: number;
}

const fmtSom = (n: number) => `${n.toLocaleString('ru-RU')} сом`;

function PaymentsTab({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<MyInvoice[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    fetch('/api/v1/fee-invoices/mine')
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setItems(j.success ? j.data : []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [studentId]);

  const mine = useMemo(() => (items ?? []).filter((i) => i.studentId === studentId), [items, studentId]);
  const totals = useMemo(() => mine.reduce(
    (t, i) => ({ amount: t.amount + i.amount, paid: t.paid + i.paid, remaining: t.remaining + i.remaining, penalty: t.penalty + i.penalty }),
    { amount: 0, paid: 0, remaining: 0, penalty: 0 },
  ), [mine]);

  if (!items) return <Center py="lg"><Loader size="sm" /></Center>;
  if (mine.length === 0) {
    return (
      <Paper withBorder p="lg" radius="md" ta="center">
        <ThemeIcon variant="light" color="teal" size={44} radius="xl" mx="auto"><IconCheck size={24} /></ThemeIcon>
        <Text mt="sm" c="dimmed">Счетов нет — задолженности отсутствуют.</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Сводка */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Paper p="md" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Начислено</Text>
          <Text fw={700} style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{fmtSom(totals.amount)}</Text>
        </Paper>
        <Paper p="md" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Оплачено</Text>
          <Text fw={700} style={{ fontSize: 20, color: '#2f9e44', fontVariantNumeric: 'tabular-nums' }}>{fmtSom(totals.paid)}</Text>
        </Paper>
        <Paper p="md" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Остаток</Text>
          <Text fw={700} style={{ fontSize: 20, color: totals.remaining > 0 ? '#f08c00' : '#2f9e44', fontVariantNumeric: 'tabular-nums' }}>{fmtSom(totals.remaining)}</Text>
        </Paper>
        <Paper p="md" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Пеня</Text>
          <Text fw={700} style={{ fontSize: 20, color: totals.penalty > 0 ? '#e03131' : '#9ba2ad', fontVariantNumeric: 'tabular-nums' }}>{totals.penalty > 0 ? `+${fmtSom(totals.penalty)}` : '—'}</Text>
        </Paper>
      </SimpleGrid>

      {totals.penalty > 0 && (
        <Paper p="sm" radius="md" withBorder style={{ border: '1px solid #ffc9c9', background: '#fff5f5' }}>
          <Group gap={8} wrap="nowrap">
            <IconAlertTriangle size={18} color="#e03131" />
            <Text size="sm" c="#c92a2a">
              Есть просроченные счета — начисляется пеня 0,1% в день. Пожалуйста, погасите задолженность.
            </Text>
          </Group>
        </Paper>
      )}

      {/* Счета */}
      <Stack gap="sm">
        {mine.map((inv) => (
          <Paper key={inv.id} p="md" radius="lg" withBorder style={{ border: inv.penalty > 0 ? '1px solid #ffc9c9' : '1px solid #e6e9ee' }}>
            <Group justify="space-between" wrap="wrap" gap="xs">
              <div style={{ minWidth: 180 }}>
                <Text fw={600}>{inv.title}</Text>
                <Text size="xs" c="dimmed">
                  {inv.period ?? ''}{inv.dueDate ? ` · срок до ${fmtDate(inv.dueDate)}` : ''}
                </Text>
              </div>
              <Group gap="lg" wrap="nowrap">
                <div>
                  <Text size="xs" c="dimmed">Сумма</Text>
                  <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtSom(inv.amount)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Оплачено</Text>
                  <Text size="sm" fw={600} c={inv.paid > 0 ? 'green' : 'dimmed'} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtSom(inv.paid)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Остаток</Text>
                  <Text size="sm" fw={600} c={inv.remaining > 0 ? 'orange' : 'green'} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtSom(inv.remaining)}</Text>
                </div>
                {inv.penalty > 0 && (
                  <div>
                    <Text size="xs" c="dimmed">Пеня</Text>
                    <Text size="sm" fw={700} c="red" style={{ fontVariantNumeric: 'tabular-nums' }}>+{fmtSom(inv.penalty)} <Text span size="xs" c="dimmed">({inv.overdueDays} дн)</Text></Text>
                  </div>
                )}
                <Badge variant="light" color={INV_COLOR[inv.status] ?? 'gray'} radius="sm">{invoiceStatusLabel(inv.status)}</Badge>
              </Group>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}

/* ── Grade colors ── */
function RoleFeedbackTab({ items }: { items: RoleFeedback[] | null }) {
  if (!items) return <Center py="lg"><Loader size="sm" /></Center>;
  if (items.length === 0) {
    return (
      <Paper withBorder p="lg" radius="md" ta="center">
        <ThemeIcon variant="light" color="teal" size={44} radius="xl" mx="auto"><IconCheck size={24} /></ThemeIcon>
        <Text mt="sm" c="dimmed">Рекомендаций пока нет.</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="sm">
      {items.map((item) => (
        <Paper key={item.id} withBorder p="md" radius="lg" style={{ border: '1px solid #e6e9ee' }}>
          <Group justify="space-between" align="flex-start" gap="sm">
            <div style={{ flex: 1 }}>
              <Group gap={6} mb={6}>
                <Badge variant="light" color={item.kind === 'recommendation' ? 'blue' : 'grape'} radius="sm">
                  {item.kind === 'recommendation' ? 'Рекомендация' : 'Отчет'}
                </Badge>
                <Badge variant="light" color="gray" radius="sm">
                  {item.audience === 'child' ? 'Ребенок' : item.audience === 'parent' ? 'Родитель' : 'Сотрудники'}
                </Badge>
              </Group>
              <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{item.text}</Text>
            </div>
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {new Date(item.createdAt).toLocaleDateString('ru-RU')}
            </Text>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

const GRADE_COLORS: Record<number, { bg: string; color: string }> = {
  5: { bg: '#d3f9d8', color: '#2f9e44' },
  4: { bg: '#dbeafe', color: '#1864ab' },
  3: { bg: '#fff3bf', color: '#f08c00' },
  2: { bg: '#ffe3e3', color: '#e03131' },
  1: { bg: '#eef0f4', color: '#6b7280' },
};

const ATT_META: Record<string, { label: string; color: string }> = {
  present: { label: 'Присутствовал', color: 'green' },
  absent: { label: 'Пропуск', color: 'red' },
  late: { label: 'Опоздание', color: 'orange' },
  excused: { label: 'Уважительная', color: 'blue' },
  trip: { label: 'Поездка', color: 'grape' },
  quarantine: { label: 'Карантин', color: 'gray' },
};

const DAY_NAMES = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

interface SubjectGrades {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  grades: { id: string; value: number; weight: number; categoryName: string; date: string; periodName: string; teacherName: string; status: string }[];
  weightedAverage: number;
}

interface AttendanceRec { date: string; status: string }
interface Homework { id: string; description: string; dueDate: string; subject: { id: string; name: string }; teacher: { firstName: string; lastName: string }; class: { grade: number; letter: string }; done?: boolean }
interface RoleFeedback { id: string; kind: string; audience: string; text: string; authorRole: string; createdAt: string }

interface ScheduleEntry {
  id: string;
  dayOfWeek: number;
  subject: { name: string; color: string | null };
  teacher: { firstName: string; lastName: string };
  slot: { slotNumber: number; startTime: string; endTime: string };
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

function DiaryContent() {
  const { me, isLoading: meLoading } = useMe();
  const [childId, setChildId] = useState<string | null>(null);
  const [grades, setGrades] = useState<SubjectGrades[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRec[] | null>(null);
  const [homework, setHomework] = useState<Homework[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[] | null>(null);
  const [feedback, setFeedback] = useState<RoleFeedback[] | null>(null);
  const [dataKey, setDataKey] = useState<string | null>(null);

  const isParent = me?.role === 'parent';
  const activeChildId = isParent ? childId ?? me?.children[0]?.studentId ?? null : null;
  const studentId = isParent ? activeChildId : me?.studentId ?? null;
  const classId = isParent
    ? me?.children.find((c) => c.studentId === activeChildId)?.classId ?? null
    : me?.student?.classId ?? null;
  const studentName = isParent
    ? (() => { const c = me?.children.find((x) => x.studentId === activeChildId); return c ? `${c.lastName} ${c.firstName}` : ''; })()
    : me?.student ? `${me.student.lastName} ${me.student.firstName}` : '';
  const className = isParent
    ? me?.children.find((x) => x.studentId === activeChildId)?.className ?? ''
    : '';

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    const end = new Date();
    const start = new Date(Date.now() - 120 * 864e5);
    const range = `startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
    Promise.all([
      fetch(`/api/v1/students/${studentId}/grades`).then((r) => r.json()).catch(() => null),
      fetch(`/api/v1/attendance?studentId=${studentId}&${range}`).then((r) => r.json()).catch(() => null),
      classId ? fetch(`/api/v1/homework?classId=${classId}&studentId=${studentId}`).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
      classId ? fetch(`/api/v1/schedule?classId=${classId}`).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
      fetch(`/api/v1/role-feedback?studentId=${studentId}`).then((r) => r.json()).catch(() => null),
    ]).then(([g, a, h, s, f]) => {
      if (cancelled) return;
      setGrades(g?.success ? g.data : []);
      setAttendance(a?.success ? a.data : []);
      setHomework(h?.success ? h.data : []);
      setSchedule(s?.success ? s.data : []);
      setFeedback(f?.success ? f.data : []);
      setDataKey(studentId);
    });
    return () => { cancelled = true; };
  }, [studentId, classId]);

  const ready = dataKey === studentId;
  const loading = !!studentId && !ready;

  async function toggleHw(h: Homework) {
    if (!studentId) return;
    const next = !h.done;
    setHomework((hw) => (hw ?? []).map((x) => (x.id === h.id ? { ...x, done: next } : x)));
    await fetch('/api/v1/homework/complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeworkId: h.id, studentId, done: next }),
    }).catch(() => {});
  }

  const attSummary = useMemo(() => {
    const s: Record<string, number> = { absent: 0, late: 0, excused: 0, present: 0 };
    (attendance ?? []).forEach((a) => { if (a.status in s) s[a.status] += 1; });
    return s;
  }, [attendance]);

  const totalAtt = Object.values(attSummary).reduce((a, b) => a + b, 0);
  const attPct = totalAtt > 0 ? Math.round(((totalAtt - attSummary.absent - attSummary.excused) / totalAtt) * 1000) / 10 : 100;

  const avgGrade = useMemo(() => {
    if (!grades || grades.length === 0) return 0;
    const avgs = grades.filter((g) => g.weightedAverage > 0).map((g) => g.weightedAverage);
    return avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
  }, [grades]);

  const upcomingHw = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return (homework ?? []).filter((h) => new Date(h.dueDate) >= today).sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  }, [homework]);

  const scheduleByDay = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    const grouped = new Map<number, ScheduleEntry[]>();
    for (const e of schedule) {
      if (!grouped.has(e.dayOfWeek)) grouped.set(e.dayOfWeek, []);
      grouped.get(e.dayOfWeek)!.push(e);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a - b).map(([day, entries]) => ({
      day, dayName: DAY_NAMES[day] ?? `День ${day}`,
      entries: entries.sort((a, b) => a.slot.slotNumber - b.slot.slotNumber),
    }));
  }, [schedule]);

  if (meLoading) return <Center h={300}><Loader /></Center>;

  if (isParent && (!me?.children || me.children.length === 0)) {
    return <Center h={300}><Stack align="center" gap="xs"><ThemeIcon size={48} radius="xl" variant="light" color="gray"><IconMoodEmpty size={28} /></ThemeIcon><Text c="dimmed">К вашему аккаунту не привязаны дети.</Text></Stack></Center>;
  }

  return (
    <Stack gap="lg">
      {/* ── Parent child switcher ── */}
      {isParent && me && me.children.length > 1 && (
        <Paper p="sm" radius="lg" withBorder style={{ border: '1px solid #e6e9ee', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text size="sm" fw={600} c="dimmed" mr={8}>Ребёнок:</Text>
          {me.children.map((c) => (
            <Box
              key={c.studentId}
              component="button"
              onClick={() => { setChildId(c.studentId); setDataKey(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px 6px 6px',
                border: `1px solid ${(activeChildId === c.studentId) ? '#339af0' : '#dde1e8'}`,
                background: (activeChildId === c.studentId) ? '#e7f5ff' : 'white',
                borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: (activeChildId === c.studentId) ? '#1864ab' : '#1f2937',
              }}
            >
              <Avatar size={28} radius="xl" color="blue">{c.firstName?.[0]}{c.lastName?.[0]}</Avatar>
              {c.firstName} · {c.className ?? ''}
            </Box>
          ))}
        </Paper>
      )}

      {/* ── Header card ── */}
      <Paper p="xl" radius="lg" withBorder style={{ border: '1px solid #e6e9ee', background: 'linear-gradient(135deg, #fff 0%, #f8f9fb 100%)' }}>
        <Group gap={20} wrap="wrap">
          <Avatar size={64} radius={16} color="blue" variant="filled" style={{ fontSize: 22 }}>
            {studentName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </Avatar>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Text fw={700} style={{ fontSize: 22, letterSpacing: '-0.02em' }}>{studentName}</Text>
            <Group gap={8} mt={4}>
              <Badge variant="light" color="blue">{className || 'Ученик'}</Badge>
            </Group>
          </div>
          <Group gap={24}>
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Средний</Text>
              <Text fw={700} style={{ fontSize: 22, color: avgGrade >= 4 ? '#2f9e44' : avgGrade >= 3 ? '#f08c00' : '#e03131', fontVariantNumeric: 'tabular-nums' }} mt={2}>{avgGrade > 0 ? avgGrade.toFixed(2) : '—'}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Посещ.</Text>
              <Text fw={700} style={{ fontSize: 22 }} mt={2}>{attPct}<span style={{ fontSize: 14, color: '#9ba2ad' }}>%</span></Text>
            </div>
          </Group>
        </Group>
      </Paper>

      {/* ── Tabs ── */}
      <Tabs defaultValue="grades" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="grades" leftSection={<IconStar size={16} />}>Оценки</Tabs.Tab>
          <Tabs.Tab value="attendance" leftSection={<IconCalendarStats size={16} />}>Посещаемость</Tabs.Tab>
          <Tabs.Tab value="homework" leftSection={<IconNotebook size={16} />}>Домашние задания</Tabs.Tab>
          <Tabs.Tab value="schedule" leftSection={<IconCalendar size={16} />}>Расписание</Tabs.Tab>
          <Tabs.Tab value="notes" leftSection={<IconMessageDots size={16} />}>Заметки</Tabs.Tab>
          <Tabs.Tab value="feedback" leftSection={<IconMessageDots size={16} />}>Рекомендации</Tabs.Tab>
          <Tabs.Tab value="payments" leftSection={<IconCash size={16} />}>Оплата</Tabs.Tab>
        </Tabs.List>

        {loading && <Center h={200}><Loader /></Center>}

        {/* ОЦЕНКИ */}
        <Tabs.Panel value="grades">
          {!loading && grades && grades.length === 0 && <Text c="dimmed" ta="center" py="xl">Оценок пока нет.</Text>}
          {!loading && grades && grades.length > 0 && (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {grades.map((sg) => {
                const gc = GRADE_COLORS[Math.round(sg.weightedAverage)] ?? GRADE_COLORS[1];
                return (
                  <Paper key={sg.subjectId} p="md" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                    <Group justify="space-between" mb={8}>
                      <Text fw={600}>{sg.subjectName}</Text>
                      {sg.weightedAverage > 0 && (
                        <Badge size="lg" radius="md" style={{ background: gc.bg, color: gc.color, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                          {sg.weightedAverage.toFixed(1)}
                        </Badge>
                      )}
                    </Group>
                    <Group gap={6}>
                      {sg.grades.map((g) => {
                        const c = GRADE_COLORS[g.value] ?? GRADE_COLORS[1];
                        return (
                          <Box key={g.id} style={{ width: 30, height: 30, borderRadius: 8, background: c.bg, color: c.color, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                            {g.value}
                          </Box>
                        );
                      })}
                    </Group>
                  </Paper>
                );
              })}
            </SimpleGrid>
          )}
        </Tabs.Panel>

        {/* ПОСЕЩАЕМОСТЬ */}
        <Tabs.Panel value="attendance">
          {!loading && (
            <>
              <SimpleGrid cols={3} spacing="md" mb="md">
                <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                  <Text fw={700} style={{ fontSize: 28, color: '#e03131' }}>{attSummary.absent}</Text>
                  <Text size="sm" c="dimmed">Пропуски</Text>
                </Paper>
                <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                  <Text fw={700} style={{ fontSize: 28, color: '#f08c00' }}>{attSummary.late}</Text>
                  <Text size="sm" c="dimmed">Опоздания</Text>
                </Paper>
                <Paper p="lg" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                  <Text fw={700} style={{ fontSize: 28, color: '#228be6' }}>{attSummary.excused}</Text>
                  <Text size="sm" c="dimmed">Уважительные</Text>
                </Paper>
              </SimpleGrid>
              {(attendance ?? []).filter((a) => a.status !== 'present').length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">Все дни присутствовал.</Text>
              ) : (
                <Stack gap={4}>
                  {(attendance ?? []).filter((a) => a.status !== 'present').sort((a, b) => +new Date(b.date) - +new Date(a.date)).map((a, i) => (
                    <Group key={i} justify="space-between" p="sm" style={{ borderBottom: '1px solid #eef0f4' }}>
                      <Text size="sm">{fmtDate(a.date)}</Text>
                      <Badge color={ATT_META[a.status]?.color ?? 'gray'} variant="light">{ATT_META[a.status]?.label ?? a.status}</Badge>
                    </Group>
                  ))}
                </Stack>
              )}
            </>
          )}
        </Tabs.Panel>

        {/* ДОМАШНИЕ ЗАДАНИЯ */}
        <Tabs.Panel value="homework">
          {!loading && upcomingHw.length === 0 && <Text c="dimmed" ta="center" py="xl">Нет заданий.</Text>}
          {!loading && upcomingHw.length > 0 && (
            <Stack gap="sm">
              {upcomingHw.map((h) => (
                <Paper key={h.id} p="md" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                  <Group justify="space-between" mb={4}>
                    <Text fw={600}>{h.subject.name}</Text>
                    <Badge variant="light" color="blue">до {fmtDate(h.dueDate)}</Badge>
                  </Group>
                  <Text size="sm">{h.description}</Text>
                  <Group justify="space-between" mt={6}>
                    <Text size="xs" c="dimmed">{h.teacher.lastName} {h.teacher.firstName}</Text>
                    <Button size="xs" radius="md" variant={h.done ? 'light' : 'filled'} color={h.done ? 'green' : 'bilimosBlue'}
                      leftSection={<IconCheck size={14} />} onClick={() => toggleHw(h)}>
                      {h.done ? 'Выполнено' : 'Отметить выполнено'}
                    </Button>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        {/* РАСПИСАНИЕ */}
        <Tabs.Panel value="schedule">
          {!loading && scheduleByDay.length === 0 && <Text c="dimmed" ta="center" py="xl">Расписание не заполнено.</Text>}
          {!loading && scheduleByDay.length > 0 && (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {scheduleByDay.map(({ day, dayName, entries }) => (
                <Paper key={day} p="md" radius="lg" withBorder style={{ border: '1px solid #e6e9ee' }}>
                  <Group gap="xs" mb="sm">
                    <Badge size="lg" variant="filled" color="blue" radius="sm">{dayName}</Badge>
                    <Text size="xs" c="dimmed">{entries.length} уроков</Text>
                  </Group>
                  <Stack gap={6}>
                    {entries.map((e, idx) => (
                      <Group key={e.id} gap={0} wrap="nowrap" style={{ borderRadius: 8, background: idx % 2 === 0 ? '#f8f9fb' : 'transparent', overflow: 'hidden' }}>
                        <div style={{ width: 4, alignSelf: 'stretch', background: e.subject.color || '#228be6', borderRadius: '4px 0 0 4px', flexShrink: 0 }} />
                        <Badge variant="light" color={e.subject.color || 'blue'} size="lg" radius="sm" w={36} ml="xs" style={{ flexShrink: 0 }}>{e.slot.slotNumber}</Badge>
                        <Stack gap={0} style={{ flex: 1, minWidth: 0, padding: '6px 8px' }}>
                          <Text size="sm" fw={600} truncate c={e.subject.color || undefined}>{e.subject.name}</Text>
                          <Text size="xs" c="dimmed" truncate>{e.teacher.lastName} {e.teacher.firstName}</Text>
                        </Stack>
                        <Text size="xs" c="dimmed" style={{ flexShrink: 0, whiteSpace: 'nowrap', paddingRight: 8 }}>
                          {(e.slot.startTime ?? '').slice(0, 5)}–{(e.slot.endTime ?? '').slice(0, 5)}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>

        {/* ── Заметки от учителей ── */}
        <Tabs.Panel value="notes">
          {studentId ? <NotesTab studentId={studentId} /> : <Text c="dimmed">Нет данных.</Text>}
        </Tabs.Panel>

        <Tabs.Panel value="feedback">
          <RoleFeedbackTab items={feedback} />
        </Tabs.Panel>

        {/* ── Оплата ── */}
        <Tabs.Panel value="payments">
          {studentId ? <PaymentsTab studentId={studentId} /> : <Text c="dimmed">Нет данных.</Text>}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

export default function DiaryPage() {
  return (
    <RoleGate roles={['student', 'parent']}>
      <DiaryContent />
    </RoleGate>
  );
}
