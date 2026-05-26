'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Card,
  Center,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconCalendar,
  IconCalendarStats,
  IconMoodEmpty,
  IconNotebook,
  IconStar,
} from '@tabler/icons-react';
import { useMe } from '@/shared/hooks/useMe';
import { RoleGate } from '@/shared/components/auth/RoleGate';

/* Цвета оценок (5-балльная шкала) */
const GRADE_COLORS: Record<number, string> = {
  5: '#2f9e44',
  4: '#1c7ed6',
  3: '#f59f00',
  2: '#e03131',
  1: '#a61e1e',
};

interface SubjectGrades {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  grades: {
    id: string;
    value: number;
    weight: number;
    categoryName: string;
    date: string;
    periodName: string;
    teacherName: string;
    status: string;
  }[];
  weightedAverage: number;
}

interface AttendanceRec {
  id: string;
  date: string;
  status: string;
}

interface Homework {
  id: string;
  description: string;
  dueDate: string;
  subject: { name: string };
  teacher: { firstName: string; lastName: string };
}

interface ScheduleEntry {
  id: string;
  dayOfWeek: number;
  subject: { name: string; color: string | null };
  teacher: { firstName: string; lastName: string };
  slot: { slotNumber: number; startTime: string; endTime: string };
}

interface DiaryData {
  key: string;
  grades: SubjectGrades[];
  attendance: AttendanceRec[];
  homework: Homework[];
  schedule: ScheduleEntry[];
}

const DAY_NAMES = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const ATT_META: Record<string, { label: string; color: string }> = {
  present: { label: 'Присутствовал', color: 'green' },
  absent: { label: 'Пропуск', color: 'red' },
  late: { label: 'Опоздание', color: 'orange' },
  excused: { label: 'Уважительная', color: 'blue' },
  trip: { label: 'Поездка', color: 'grape' },
  quarantine: { label: 'Карантин', color: 'gray' },
};

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

function avgColor(v: number): string {
  return GRADE_COLORS[Math.round(v)] ?? '#868e96';
}

function DiaryContent() {
  const { me, isLoading: meLoading } = useMe();
  const [childId, setChildId] = useState<string | null>(null);
  const [data, setData] = useState<DiaryData | null>(null);

  const isParent = me?.role === 'parent';
  // Выбранный ученик: для родителя — выбранный или первый ребёнок; для ученика — он сам.
  const activeChildId = isParent ? childId ?? me?.children[0]?.studentId ?? null : null;
  const studentId = isParent ? activeChildId : me?.studentId ?? null;
  const classId = isParent
    ? me?.children.find((c) => c.studentId === activeChildId)?.classId ?? null
    : me?.student?.classId ?? null;
  const studentName = isParent
    ? (() => {
        const c = me?.children.find((x) => x.studentId === activeChildId);
        return c ? `${c.lastName} ${c.firstName}` : '';
      })()
    : me?.student
      ? `${me.student.lastName} ${me.student.firstName}`
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
      classId
        ? fetch(`/api/v1/homework?classId=${classId}`).then((r) => r.json()).catch(() => null)
        : Promise.resolve(null),
      classId
        ? fetch(`/api/v1/schedule?classId=${classId}`).then((r) => r.json()).catch(() => null)
        : Promise.resolve(null),
    ]).then(([g, a, h, s]) => {
      if (cancelled) return;
      setData({
        key: studentId,
        grades: g?.success ? g.data : [],
        attendance: a?.success ? a.data : [],
        homework: h?.success ? h.data : [],
        schedule: s?.success ? s.data : [],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [studentId, classId]);

  const ready = data?.key === studentId ? data : null;
  const loading = !!studentId && !ready;
  const grades = ready?.grades ?? null;
  const attendance = ready?.attendance ?? null;
  const homework = ready?.homework ?? null;
  const schedule = ready?.schedule ?? null;

  const attSummary = useMemo(() => {
    const s: Record<string, number> = { absent: 0, late: 0, excused: 0, trip: 0, quarantine: 0, present: 0 };
    (attendance ?? []).forEach((a) => {
      if (a.status in s) s[a.status] += 1;
    });
    return s;
  }, [attendance]);

  const attNonPresent = useMemo(
    () =>
      (attendance ?? [])
        .filter((a) => a.status !== 'present')
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [attendance],
  );

  const scheduleByDay = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    const grouped = new Map<number, ScheduleEntry[]>();
    for (const e of schedule) {
      if (!grouped.has(e.dayOfWeek)) grouped.set(e.dayOfWeek, []);
      grouped.get(e.dayOfWeek)!.push(e);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, entries]) => ({
        day,
        dayName: DAY_NAMES[day] ?? `День ${day}`,
        entries: entries.sort((a, b) => a.slot.slotNumber - b.slot.slotNumber),
      }));
  }, [schedule]);

  const upcomingHw = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (homework ?? [])
      .filter((h) => new Date(h.dueDate) >= today)
      .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  }, [homework]);

  if (meLoading) {
    return (
      <Center h={300}>
        <Loader />
      </Center>
    );
  }

  if (isParent && (!me?.children || me.children.length === 0)) {
    return (
      <Center h={300}>
        <Stack align="center" gap="xs">
          <ThemeIcon size={48} radius="xl" variant="light" color="gray">
            <IconMoodEmpty size={28} />
          </ThemeIcon>
          <Text c="dimmed">К вашему аккаунту не привязаны дети.</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box>
      <Group justify="space-between" align="flex-end" mb="md" wrap="wrap">
        <Box>
          <Title order={3}>Дневник</Title>
          {studentName && (
            <Text c="dimmed" size="sm">
              {studentName}
            </Text>
          )}
        </Box>
        {isParent && me && me.children.length > 0 && (
          <Select
            label="Ребёнок"
            data={me.children.map((c) => ({
              value: c.studentId,
              label: `${c.lastName} ${c.firstName}${c.className ? ` · ${c.className}` : ''}`,
            }))}
            value={activeChildId}
            onChange={setChildId}
            allowDeselect={false}
            w={220}
          />
        )}
      </Group>

      <Tabs defaultValue="grades" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="grades" leftSection={<IconStar size={16} />}>
            Оценки
          </Tabs.Tab>
          <Tabs.Tab value="attendance" leftSection={<IconCalendarStats size={16} />}>
            Посещаемость
          </Tabs.Tab>
          <Tabs.Tab value="homework" leftSection={<IconNotebook size={16} />}>
            Домашние задания
          </Tabs.Tab>
          <Tabs.Tab value="schedule" leftSection={<IconCalendar size={16} />}>
            Расписание
          </Tabs.Tab>
        </Tabs.List>

        {loading && (
          <Center h={200}>
            <Loader />
          </Center>
        )}

        {/* ОЦЕНКИ */}
        <Tabs.Panel value="grades">
          {!loading && grades && grades.length === 0 && (
            <Text c="dimmed" ta="center" py="xl">
              Опубликованных оценок пока нет.
            </Text>
          )}
          {!loading && grades && grades.length > 0 && (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {grades.map((s) => (
                <Card key={s.subjectId} withBorder radius="md" padding="md">
                  <Group justify="space-between" mb="sm" wrap="nowrap">
                    <Text fw={600} lineClamp={1}>
                      {s.subjectName}
                    </Text>
                    <Badge
                      size="lg"
                      radius="sm"
                      variant="filled"
                      style={{ backgroundColor: avgColor(s.weightedAverage) }}
                    >
                      {s.weightedAverage.toFixed(1)}
                    </Badge>
                  </Group>
                  <Group gap={6}>
                    {s.grades.map((g) => (
                      <Tooltip
                        key={g.id}
                        label={`${g.value} · ${g.categoryName} · ${fmtDate(g.date)} · ${g.teacherName}`}
                        withArrow
                      >
                        <Box
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: 700,
                            backgroundColor: GRADE_COLORS[g.value] ?? '#868e96',
                          }}
                        >
                          {g.value}
                        </Box>
                      </Tooltip>
                    ))}
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>

        {/* ПОСЕЩАЕМОСТЬ */}
        <Tabs.Panel value="attendance">
          {!loading && attendance && (
            <Stack gap="md">
              <SimpleGrid cols={{ base: 3 }} spacing="sm">
                {[
                  { key: 'absent', label: 'Пропуски', color: 'red' },
                  { key: 'late', label: 'Опоздания', color: 'orange' },
                  { key: 'excused', label: 'Уважительные', color: 'blue' },
                ].map((m) => (
                  <Card key={m.key} withBorder radius="md" padding="md">
                    <Text fw={700} style={{ fontSize: 32, lineHeight: 1, color: `var(--mantine-color-${m.color}-6)` }}>
                      {attSummary[m.key]}
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>
                      {m.label}
                    </Text>
                  </Card>
                ))}
              </SimpleGrid>

              {attNonPresent.length === 0 ? (
                <Text c="dimmed" ta="center" py="md">
                  Пропусков и опозданий нет — отличная посещаемость!
                </Text>
              ) : (
                <Stack gap={6}>
                  {attNonPresent.map((a) => (
                    <Group key={a.id} justify="space-between" px="xs">
                      <Text size="sm">{fmtDate(a.date)}</Text>
                      <Badge color={ATT_META[a.status]?.color ?? 'gray'} variant="light">
                        {ATT_META[a.status]?.label ?? a.status}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              )}
            </Stack>
          )}
        </Tabs.Panel>

        {/* ДОМАШНИЕ ЗАДАНИЯ */}
        <Tabs.Panel value="homework">
          {!loading && homework && upcomingHw.length === 0 && (
            <Text c="dimmed" ta="center" py="xl">
              Предстоящих домашних заданий нет.
            </Text>
          )}
          {!loading && upcomingHw.length > 0 && (
            <Stack gap="sm">
              {upcomingHw.map((h) => (
                <Card key={h.id} withBorder radius="md" padding="md">
                  <Group justify="space-between" mb={4} wrap="nowrap">
                    <Text fw={600}>{h.subject.name}</Text>
                    <Badge variant="light" color="eruditBlue">
                      до {fmtDate(h.dueDate)}
                    </Badge>
                  </Group>
                  <Text size="sm">{h.description}</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    {h.teacher.lastName} {h.teacher.firstName}
                  </Text>
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        {/* РАСПИСАНИЕ */}
        <Tabs.Panel value="schedule">
          {!loading && scheduleByDay.length === 0 && (
            <Text c="dimmed" ta="center" py="xl">
              Расписание пока не заполнено.
            </Text>
          )}
          {!loading && scheduleByDay.length > 0 && (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {scheduleByDay.map(({ day, dayName, entries }) => (
                <Card key={day} withBorder radius="md" padding="md">
                  <Group gap="xs" mb="sm">
                    <Badge size="lg" variant="filled" color="blue" radius="sm">
                      {dayName}
                    </Badge>
                    <Text size="xs" c="dimmed">{entries.length} уроков</Text>
                  </Group>
                  <Stack gap={6}>
                    {entries.map((e, idx) => (
                      <Group
                        key={e.id}
                        gap={0}
                        wrap="nowrap"
                        py={0}
                        style={{
                          borderRadius: 8,
                          background: idx % 2 === 0 ? 'var(--mantine-color-gray-0)' : 'transparent',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{
                          width: 4,
                          alignSelf: 'stretch',
                          background: e.subject.color || '#228be6',
                          borderRadius: '4px 0 0 4px',
                          flexShrink: 0,
                        }} />
                        <Badge
                          variant="light"
                          color={e.subject.color || 'blue'}
                          size="lg"
                          radius="sm"
                          w={36}
                          ml="xs"
                          style={{ flexShrink: 0 }}
                        >
                          {e.slot.slotNumber}
                        </Badge>
                        <Stack gap={0} style={{ flex: 1, minWidth: 0, padding: '6px 8px' }}>
                          <Text size="sm" fw={600} truncate c={e.subject.color || undefined}>
                            {e.subject.name}
                          </Text>
                          <Text size="xs" c="dimmed" truncate>
                            {e.teacher.lastName} {e.teacher.firstName}
                          </Text>
                        </Stack>
                        <Text size="xs" c="dimmed" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {(e.slot.startTime ?? '').slice(0, 5)}–{(e.slot.endTime ?? '').slice(0, 5)}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}

export default function DiaryPage() {
  return (
    <RoleGate roles={['student', 'parent']}>
      <DiaryContent />
    </RoleGate>
  );
}
