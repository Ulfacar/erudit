'use client';

/**
 * «Журнал класса» — простое EduPage-стиль оценивание: выбрал класс+предмет →
 * строки учеников с инлайн-вводом балла (Enter прыгает вниз) + посещаемость.
 * Тот же быстрый грид, что в «Сегодня», но для любого класса и любой даты.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Group, Loader, NumberInput, Paper, ScrollArea, Select,
  Stack, Table, Text, TextInput, Title,
} from '@mantine/core';
import { IconBook2, IconCircleCheck } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useRole } from '@/shared/hooks/useRole';
import { EditableGradeBadge } from '@/shared/components/grading/EditableGradeBadge';

interface Pair { subjectId: string; subjectName: string; classId: string; className: string }
interface Period { id: string; name: string; isActive: boolean }
interface Student { id: string; firstName: string; lastName: string; middleName?: string | null }
interface Category { id: string; name: string; weight: number }
interface Grade { id: string; studentId: string; value: number; category: { id: string; name: string; weight: number }; editWindowExpired?: boolean }

type AttStatus = 'present' | 'absent' | 'late';
const ATT_BTN: { status: AttStatus; label: string; color: string }[] = [
  { status: 'present', label: 'П', color: 'green' },
  { status: 'absent', label: 'Н', color: 'red' },
  { status: 'late', label: 'О', color: 'yellow' },
];
const SEC = 'var(--mantine-color-dimmed)';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Journal() {
  const { role } = useRole();
  const canDelete = role === 'zavuch' || role === 'super_admin' || role === 'analyst';
  const [loading, setLoading] = useState(true);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const [pairKey, setPairKey] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());

  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttStatus>>({});
  const [drafts, setDrafts] = useState<Record<string, number | ''>>({});
  const [gridLoading, setGridLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [attSaving, setAttSaving] = useState<string | null>(null);
  const [attAllSaving, setAttAllSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [optRes, catsRes] = await Promise.all([
          fetch('/api/v1/curriculum-plan/options'),
          fetch('/api/v1/grading/categories'),
        ]);
        const opt = await optRes.json();
        const cats = await catsRes.json();
        if (opt.success) {
          setPairs(opt.data.pairs);
          setPeriods(opt.data.periods);
          setTeacherId(opt.data.teacherId ?? null);
          const active = opt.data.periods.find((p: Period) => p.isActive);
          setPeriodId(active?.id ?? opt.data.periods[0]?.id ?? null);
        }
        if (cats.success) {
          const seen = new Set<string>();
          const uniq: Category[] = [];
          for (const c of cats.data as Category[]) if (!seen.has(c.name)) { seen.add(c.name); uniq.push(c); }
          setCategories(uniq);
          const assess = uniq.find((c) => /контрол|тест|зачёт|экзам/i.test(c.name)) ?? uniq[0];
          setCategoryId(assess?.id ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = useMemo(() => pairs.find((p) => `${p.subjectId}|${p.classId}` === pairKey) ?? null, [pairs, pairKey]);

  const loadGrid = useCallback(async () => {
    if (!selected || !periodId) return;
    setGridLoading(true);
    setDrafts({});
    setAttendance({});
    try {
      const [sRes, gRes, aRes] = await Promise.all([
        fetch(`/api/v1/students?classId=${selected.classId}`),
        fetch(`/api/v1/grading?classId=${selected.classId}&subjectId=${selected.subjectId}&periodId=${periodId}`),
        fetch(`/api/v1/attendance?classId=${selected.classId}&date=${date}`),
      ]);
      const s = await sRes.json();
      const g = await gRes.json();
      const a = await aRes.json();
      if (s.success) setStudents(s.data);
      if (g.success) setGrades(g.data);
      if (a.success) {
        const map: Record<string, AttStatus> = {};
        for (const rec of a.data as { studentId: string; status: string }[]) {
          if (rec.status === 'present' || rec.status === 'absent' || rec.status === 'late') map[rec.studentId] = rec.status;
        }
        setAttendance(map);
      }
    } finally {
      setGridLoading(false);
    }
  }, [selected, periodId, date]);

  useEffect(() => { if (selected && periodId) loadGrid(); }, [selected, periodId, date, loadGrid]);

  const avgByStudent = useMemo(() => {
    const acc: Record<string, { sum: number; w: number }> = {};
    for (const gr of grades) {
      const a = acc[gr.studentId] ?? { sum: 0, w: 0 };
      a.sum += gr.value * gr.category.weight; a.w += gr.category.weight; acc[gr.studentId] = a;
    }
    const map: Record<string, number> = {};
    for (const [sid, a] of Object.entries(acc)) map[sid] = a.w ? Math.round((a.sum / a.w) * 10) / 10 : 0;
    return map;
  }, [grades]);

  const gradesByStudent = useMemo(() => {
    const map: Record<string, Grade[]> = {};
    for (const gr of grades) (map[gr.studentId] ??= []).push(gr);
    return map;
  }, [grades]);

  const reloadGrades = useCallback(async () => {
    if (!selected || !periodId) return;
    const g = await (await fetch(`/api/v1/grading?classId=${selected.classId}&subjectId=${selected.subjectId}&periodId=${periodId}`)).json();
    if (g.success) setGrades(g.data);
  }, [selected, periodId]);

  async function saveGrade(studentId: string) {
    const value = drafts[studentId];
    if (value === '' || value === undefined || !selected || !teacherId || !periodId || !categoryId) return;
    setSavingId(studentId);
    try {
      const res = await fetch('/api/v1/grading', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, subjectId: selected.subjectId, categoryId, teacherId, periodId, value: Number(value), scale: 'HUNDRED', date }),
      });
      const json = await res.json();
      if (json.success) {
        setDrafts((d) => ({ ...d, [studentId]: '' }));
        const g = await (await fetch(`/api/v1/grading?classId=${selected.classId}&subjectId=${selected.subjectId}&periodId=${periodId}`)).json();
        if (g.success) setGrades(g.data);
      }
    } finally {
      setSavingId(null);
    }
  }

  async function markAttendance(studentId: string, status: AttStatus) {
    setAttSaving(studentId);
    setAttendance((m) => ({ ...m, [studentId]: status }));
    try {
      await fetch('/api/v1/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, date, status }),
      });
    } finally {
      setAttSaving(null);
    }
  }

  async function markAllPresent() {
    if (!students.length) return;
    setAttAllSaving(true);
    const next = { ...attendance };
    try {
      for (const st of students.filter((s) => !attendance[s.id])) {
        next[st.id] = 'present';
        await fetch('/api/v1/attendance', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: st.id, date, status: 'present' }),
        });
      }
      setAttendance(next);
    } finally {
      setAttAllSaving(false);
    }
  }

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;

  const pairOptions = pairs.map((p) => ({ value: `${p.subjectId}|${p.classId}`, label: `${p.className} · ${p.subjectName}` }));
  const periodOptions = periods.map((p) => ({ value: p.id, label: p.name }));
  const catOptions = categories.map((c) => ({ value: c.id, label: `${c.name} ×${c.weight}` }));

  return (
    <Stack gap="md" p="md">
      <Group gap="xs">
        <IconBook2 size={26} color="var(--mantine-color-blue-6)" />
        <div>
          <Title order={2}>Журнал класса</Title>
          <Text c="dimmed" size="sm">Выберите класс и предмет — ставьте баллы прямо в строках.</Text>
        </div>
      </Group>

      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <Select label="Класс и предмет" data={pairOptions} value={pairKey} onChange={setPairKey} searchable w={260} placeholder="Выберите" />
          <Select label="Период" data={periodOptions} value={periodId} onChange={setPeriodId} w={150} />
          <TextInput label="Дата" type="date" value={date} onChange={(e) => setDate(e.currentTarget.value)} w={160} />
          <Select label="Тип работы (вес)" data={catOptions} value={categoryId} onChange={setCategoryId} searchable w={200} />
        </Group>
      </Paper>

      {!selected ? (
        <Text c="dimmed" ta="center" py="lg">Выберите класс и предмет, чтобы открыть журнал.</Text>
      ) : !teacherId ? (
        <Text c="dimmed" ta="center" py="lg">Выставление оценок доступно учителю (нет привязки к преподавателю).</Text>
      ) : (
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="sm" wrap="nowrap">
            <Text fw={600}>Журнал · {selected.className} · {selected.subjectName}</Text>
            <Button size="xs" variant="light" color="green" loading={attAllSaving} onClick={markAllPresent} leftSection={<IconCircleCheck size={14} />}>
              Все были
            </Button>
          </Group>
          {gridLoading ? (
            <Group justify="center" p="md"><Loader size="sm" /></Group>
          ) : (
            <ScrollArea>
              <Table highlightOnHover style={{ minWidth: 600 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ color: SEC, fontSize: 12 }}>Ученик</Table.Th>
                    <Table.Th style={{ color: SEC, fontSize: 12, width: 130 }}>Был</Table.Th>
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
                        <Button.Group>
                          {ATT_BTN.map((b) => (
                            <Button key={b.status} size="compact-xs" px={8}
                              variant={attendance[st.id] === b.status ? 'filled' : 'default'} color={b.color}
                              loading={attSaving === st.id && attendance[st.id] === b.status}
                              onClick={() => markAttendance(st.id, b.status)}>
                              {b.label}
                            </Button>
                          ))}
                        </Button.Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {(gradesByStudent[st.id] ?? []).map((gr) => (
                            <EditableGradeBadge key={gr.id} grade={gr} canDelete={canDelete} onChanged={reloadGrades} />
                          ))}
                          {!(gradesByStudent[st.id]?.length) && <Text size="xs" c={SEC}>—</Text>}
                        </Group>
                      </Table.Td>
                      <Table.Td><Text fw={700} c={avgByStudent[st.id] ? '#2f9e44' : SEC}>{avgByStudent[st.id] ?? '—'}</Text></Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <NumberInput size="xs" w={70} min={0} max={100} hideControls placeholder="0–100"
                            value={drafts[st.id] ?? ''}
                            onChange={(v) => setDrafts((d) => ({ ...d, [st.id]: v as number }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveGrade(st.id);
                                const next = students[idx + 1];
                                if (next) (document.getElementById(`jg-${next.id}`) as HTMLInputElement | null)?.focus();
                              }
                            }}
                            id={`jg-${st.id}`} />
                          <Button size="xs" variant="light" loading={savingId === st.id} onClick={() => saveGrade(st.id)}
                            disabled={drafts[st.id] === '' || drafts[st.id] === undefined}>ОК</Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
          <Text size="xs" c={SEC} mt="xs">Балл 0–100, вес из типа работы. Итог — взвешенное среднее. Оценка ставится сразу.</Text>
        </Paper>
      )}
    </Stack>
  );
}

export default function JournalPage() {
  return (
    <RoleGate roles={['teacher', 'curator', 'zavuch', 'super_admin', 'analyst']}>
      <Journal />
    </RoleGate>
  );
}
