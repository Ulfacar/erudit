'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
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
  IconCalendar,
  IconCalendarStats,
  IconChevronLeft,
  IconChevronRight,
  IconMoodEmpty,
  IconNotebook,
  IconStar,
} from '@tabler/icons-react';
import { useMe } from '@/shared/hooks/useMe';
import { RoleGate } from '@/shared/components/auth/RoleGate';

/* ── Grade colors ── */
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
interface Homework { id: string; description: string; dueDate: string; subject: { id: string; name: string }; teacher: { firstName: string; lastName: string }; class: { grade: number; letter: string } }

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
      classId ? fetch(`/api/v1/homework?classId=${classId}`).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
      classId ? fetch(`/api/v1/schedule?classId=${classId}`).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
    ]).then(([g, a, h, s]) => {
      if (cancelled) return;
      setGrades(g?.success ? g.data : []);
      setAttendance(a?.success ? a.data : []);
      setHomework(h?.success ? h.data : []);
      setSchedule(s?.success ? s.data : []);
      setDataKey(studentId);
    });
    return () => { cancelled = true; };
  }, [studentId, classId]);

  const ready = dataKey === studentId;
  const loading = !!studentId && !ready;

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
                  <Text size="xs" c="dimmed" mt={4}>{h.teacher.lastName} {h.teacher.firstName}</Text>
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
