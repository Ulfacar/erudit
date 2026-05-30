'use client';

/**
 * Учительский cockpit «Сегодня» (EduPage-стиль, просто и быстро).
 * Главная учителя: уроки на сегодня → клик → грид баллов 0-100 с весами → итог.
 * Оценка ставится сразу финально (модерация выключена на категориях).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Button, Group, Loader, NumberInput, Paper, ScrollArea, Select,
  Stack, Table, Text, TextInput, Title,
} from '@mantine/core';
import { IconClock, IconChevronRight, IconCircleCheck } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const SURFACE = '#ffffff';
const BORDER = '#e6e9ee';
const SEC = 'var(--mantine-color-dimmed)';

interface Lesson {
  scheduleId: string; classId: string; className: string;
  subjectId: string; subjectName: string; subjectColor: string | null;
  slotNumber: number; startTime: string; endTime: string; gradesEntered: number; topic: string;
}
interface Student { id: string; firstName: string; lastName: string; middleName?: string | null }
interface Category { id: string; name: string; weight: number }
interface Grade {
  id: string; studentId: string; value: number; date: string;
  category: { id: string; name: string; weight: number };
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Cockpit() {
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState<Lesson | null>(null);

  // grid state
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, number | ''>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [topicDraft, setTopicDraft] = useState('');
  const [topicSaved, setTopicSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [todayRes, meRes, periodsRes, catsRes] = await Promise.all([
          fetch('/api/v1/schedule/teacher-today'),
          fetch('/api/v1/me'),
          fetch('/api/v1/periods'),
          fetch('/api/v1/grading/categories'),
        ]);
        const today = await todayRes.json();
        const me = await meRes.json();
        const periods = await periodsRes.json();
        const cats = await catsRes.json();
        if (today.success) setLessons(today.data.lessons);
        if (me.success) setTeacherId(me.data.teacherId ?? null);
        if (periods.success) {
          const active = periods.data.find((p: { isActive: boolean }) => p.isActive) ?? periods.data[0];
          setPeriodId(active?.id ?? null);
        }
        if (cats.success) {
          // дедуп по имени (в данных есть задвоенные категории)
          const seen = new Set<string>();
          const uniq: Category[] = [];
          for (const c of cats.data as Category[]) {
            if (!seen.has(c.name)) { seen.add(c.name); uniq.push(c); }
          }
          setCategories(uniq);
          const assess = uniq.find((c) => /контрол|тест|зачёт|экзам/i.test(c.name)) ?? uniq[0];
          setCategoryId(assess?.id ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadGrid = useCallback(async (lesson: Lesson) => {
    if (!periodId) return;
    setGridLoading(true);
    setDrafts({});
    try {
      const [sRes, gRes] = await Promise.all([
        fetch(`/api/v1/students?classId=${lesson.classId}`),
        fetch(`/api/v1/grading?classId=${lesson.classId}&subjectId=${lesson.subjectId}&periodId=${periodId}`),
      ]);
      const s = await sRes.json();
      const g = await gRes.json();
      if (s.success) setStudents(s.data);
      if (g.success) setGrades(g.data);
    } finally {
      setGridLoading(false);
    }
  }, [periodId]);

  function openLesson(l: Lesson) {
    setOpen(l);
    setTopicDraft(l.topic ?? '');
    setTopicSaved(false);
    loadGrid(l);
  }

  async function saveTopic() {
    if (!open) return;
    try {
      const res = await fetch('/api/v1/lesson-topics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: open.classId, subjectId: open.subjectId, date: todayISO(), topic: topicDraft }),
      });
      const json = await res.json();
      if (json.success) {
        setTopicSaved(true);
        setLessons((ls) => ls.map((x) => (x.scheduleId === open.scheduleId ? { ...x, topic: topicDraft } : x)));
      }
    } catch { /* ignore */ }
  }

  // weighted average per student from loaded grades
  const avgByStudent = useMemo(() => {
    const map: Record<string, number> = {};
    const acc: Record<string, { sum: number; w: number }> = {};
    for (const gr of grades) {
      const a = acc[gr.studentId] ?? { sum: 0, w: 0 };
      a.sum += gr.value * gr.category.weight;
      a.w += gr.category.weight;
      acc[gr.studentId] = a;
    }
    for (const [sid, a] of Object.entries(acc)) {
      map[sid] = a.w ? Math.round((a.sum / a.w) * 10) / 10 : 0;
    }
    return map;
  }, [grades]);

  const gradesByStudent = useMemo(() => {
    const map: Record<string, Grade[]> = {};
    for (const gr of grades) (map[gr.studentId] ??= []).push(gr);
    return map;
  }, [grades]);

  async function saveGrade(studentId: string) {
    const value = drafts[studentId];
    if (value === '' || value === undefined || !open || !teacherId || !periodId || !categoryId) return;
    setSavingId(studentId);
    try {
      const res = await fetch('/api/v1/grading', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId, subjectId: open.subjectId, categoryId, teacherId,
          periodId, value: Number(value), scale: 'HUNDRED', date: todayISO(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDrafts((d) => ({ ...d, [studentId]: '' }));
        // подтянуть свежие оценки (итог пересчитается)
        const g = await (await fetch(`/api/v1/grading?classId=${open.classId}&subjectId=${open.subjectId}&periodId=${periodId}`)).json();
        if (g.success) setGrades(g.data);
      }
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <Group justify="center" p="xl"><Loader color="blue" /></Group>;

  const catOptions = categories.map((c) => ({ value: c.id, label: `${c.name} ×${c.weight}` }));
  const dateLabel = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Stack gap="md">
      <Group gap={8}>
        <IconClock size={22} color="#228be6" />
        <Title order={3} c="var(--mantine-color-text)">Сегодня</Title>
        <Text c={SEC} size="sm" style={{ textTransform: 'capitalize' }}>{dateLabel}</Text>
      </Group>

      {lessons.length === 0 ? (
        <Paper p="xl" radius="md" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <Text c={SEC} ta="center">На сегодня уроков нет.</Text>
        </Paper>
      ) : (
        <Stack gap="xs">
          {lessons.map((l) => {
            const isOpen = open?.scheduleId === l.scheduleId;
            return (
              <Box key={l.scheduleId}>
                <Paper
                  onClick={() => (isOpen ? setOpen(null) : openLesson(l))}
                  p="md" radius="md"
                  style={{
                    background: SURFACE, border: `1px solid ${isOpen ? '#228be6' : BORDER}`,
                    cursor: 'pointer', borderLeft: `4px solid ${l.subjectColor || '#228be6'}`,
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="md" wrap="nowrap">
                      <Stack gap={0} align="center" style={{ minWidth: 56 }}>
                        <Text fw={700} size="lg" c="var(--mantine-color-text)">{l.startTime}</Text>
                        <Text size="xs" c={SEC}>{l.endTime}</Text>
                      </Stack>
                      <Box>
                        <Group gap={8}>
                          <Badge variant="light" color="blue" radius="sm" size="lg">{l.className}</Badge>
                          <Text fw={600} c="var(--mantine-color-text)">{l.subjectName}</Text>
                        </Group>
                        <Text size="xs" c={SEC} mt={4}>{l.slotNumber} урок</Text>
                      </Box>
                    </Group>
                    <Group gap={8} wrap="nowrap">
                      {l.gradesEntered > 0 && (
                        <Badge variant="light" color="green" leftSection={<IconCircleCheck size={12} />}>
                          {l.gradesEntered}
                        </Badge>
                      )}
                      <IconChevronRight size={18} color={SEC} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                    </Group>
                  </Group>
                </Paper>

                {isOpen && (
                  <Paper mt={4} p="md" radius="md" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                    <Group gap="xs" mb="sm" align="flex-end">
                      <TextInput
                        label="Тема урока" size="xs" style={{ flex: 1 }}
                        placeholder="Что прошли на уроке"
                        value={topicDraft}
                        onChange={(e) => { setTopicDraft(e.currentTarget.value); setTopicSaved(false); }}
                        onBlur={saveTopic}
                      />
                      <Button size="xs" variant="light" color={topicSaved ? 'green' : 'blue'} onClick={saveTopic}>
                        {topicSaved ? 'Сохранено' : 'Сохранить тему'}
                      </Button>
                    </Group>
                    <Group justify="space-between" mb="sm">
                      <Text fw={600} c="var(--mantine-color-text)">Журнал · {l.className} · {l.subjectName}</Text>
                      <Select
                        label={undefined} size="xs" w={240}
                        data={catOptions} value={categoryId} onChange={setCategoryId}
                        placeholder="Тип работы (вес)" searchable
                      />
                    </Group>
                    {gridLoading ? (
                      <Group justify="center" p="md"><Loader size="sm" color="blue" /></Group>
                    ) : (
                      <ScrollArea>
                        <Table highlightOnHover style={{ minWidth: 560 }}>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th style={{ color: SEC, fontSize: 12 }}>Ученик</Table.Th>
                              <Table.Th style={{ color: SEC, fontSize: 12 }}>Оценки</Table.Th>
                              <Table.Th style={{ color: SEC, fontSize: 12, width: 70 }}>Итог</Table.Th>
                              <Table.Th style={{ color: SEC, fontSize: 12, width: 150 }}>Поставить балл</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {students.map((st, idx) => (
                              <Table.Tr key={st.id}>
                                <Table.Td><Text size="sm">{st.lastName} {st.firstName}</Text></Table.Td>
                                <Table.Td>
                                  <Group gap={4}>
                                    {(gradesByStudent[st.id] ?? []).map((gr) => (
                                      <Badge key={gr.id} variant="light" color="gray" radius="sm"
                                        title={`${gr.category.name} ×${gr.category.weight}`}>
                                        {gr.value}{gr.category.weight > 1 ? `·${gr.category.weight}` : ''}
                                      </Badge>
                                    ))}
                                    {!(gradesByStudent[st.id]?.length) && <Text size="xs" c={SEC}>—</Text>}
                                  </Group>
                                </Table.Td>
                                <Table.Td>
                                  <Text fw={700} c={avgByStudent[st.id] ? '#2f9e44' : SEC}>
                                    {avgByStudent[st.id] ?? '—'}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Group gap={4} wrap="nowrap">
                                    <NumberInput
                                      size="xs" w={70} min={0} max={100} hideControls
                                      placeholder="0–100"
                                      value={drafts[st.id] ?? ''}
                                      onChange={(v) => setDrafts((d) => ({ ...d, [st.id]: v as number }))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          saveGrade(st.id);
                                          const next = students[idx + 1];
                                          if (next) {
                                            const el = document.getElementById(`grade-${next.id}`) as HTMLInputElement | null;
                                            el?.focus();
                                          }
                                        }
                                      }}
                                      id={`grade-${st.id}`}
                                    />
                                    <Button size="xs" variant="light" loading={savingId === st.id}
                                      onClick={() => saveGrade(st.id)} disabled={drafts[st.id] === '' || drafts[st.id] === undefined}>
                                      ОК
                                    </Button>
                                  </Group>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    )}
                    <Text size="xs" c={SEC} mt="xs">
                      Балл 0–100, вес берётся из типа работы. Итог — взвешенное среднее. Оценка ставится сразу (без модерации).
                    </Text>
                  </Paper>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

export default function TodayPage() {
  return (
    <RoleGate roles={['teacher', 'curator', 'super_admin', 'zavuch']}>
      <Cockpit />
    </RoleGate>
  );
}
