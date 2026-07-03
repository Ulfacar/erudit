'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Checkbox, Group, Loader, Modal, NumberInput, Paper, Radio, ScrollArea,
  Select, Stack, Table, Text, Textarea, TextInput, Title,
} from '@mantine/core';
import { IconChecklist, IconPlus, IconTrash } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useMe } from '@/shared/hooks/useMe';

const SURFACE = '#ffffff';
const BORDER = '#e6e9ee';
const SEC = 'var(--mantine-color-dimmed)';
const STAFF = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'];

const QTYPES = [
  { value: 'single', label: 'Один ответ' },
  { value: 'multiple', label: 'Несколько ответов' },
  { value: 'number', label: 'Числовой' },
  { value: 'text', label: 'Открытый (проверяет учитель)' },
];

interface TestRow {
  id: string; title: string; description: string | null; questionCount: number;
  attemptCount?: number; myAttempt?: { score: number; maxScore: number } | null;
}
interface BuilderQ { text: string; type: string; options: string[]; correct: string[]; numberValue: string; points: number }
interface TakeQ { id: string; text: string; type: string; options: string[]; points: number }

function Tests() {
  const { me } = useMe();
  const isStaff = me ? STAFF.includes(me.role) : false;
  const [rows, setRows] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/tests');
      const json = await res.json();
      if (json.success) setRows(json.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── builder (staff) ──
  const [bOpen, setBOpen] = useState(false);
  const [bTitle, setBTitle] = useState('');
  const [bDesc, setBDesc] = useState('');
  const [bQs, setBQs] = useState<BuilderQ[]>([{ text: '', type: 'single', options: ['', ''], correct: [], numberValue: '', points: 1 }]);
  const [bErr, setBErr] = useState('');
  const [bSaving, setBSaving] = useState(false);

  function setQ(i: number, patch: Partial<BuilderQ>) { setBQs((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q))); }

  async function saveTest() {
    if (!bTitle || bQs.some((q) => !q.text)) { setBErr('Заполните заголовок и тексты вопросов'); return; }
    setBSaving(true); setBErr('');
    try {
      const questions = bQs.map((q) => ({
        text: q.text, type: q.type, points: q.points,
        options: q.type === 'single' || q.type === 'multiple' ? q.options.filter((o) => o.trim()) : [],
        correctAnswers: q.type === 'number' ? [q.numberValue] : q.type === 'text' ? [] : q.correct,
      }));
      const res = await fetch('/api/v1/tests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bTitle, description: bDesc, questions }),
      });
      const json = await res.json();
      if (json.success) { setBOpen(false); setBTitle(''); setBDesc(''); setBQs([{ text: '', type: 'single', options: ['', ''], correct: [], numberValue: '', points: 1 }]); load(); }
      else setBErr(json.error?.message || 'Ошибка');
    } finally { setBSaving(false); }
  }

  // ── results (staff) ──
  const [resOpen, setResOpen] = useState(false);
  const [resData, setResData] = useState<{ title: string; attemptList: { studentName: string; score: number; maxScore: number }[] } | null>(null);
  async function openResults(id: string) {
    setResOpen(true); setResData(null);
    const json = await (await fetch(`/api/v1/tests/${id}`)).json();
    if (json.success) setResData({ title: json.data.title, attemptList: json.data.attemptList ?? [] });
  }

  // ── take (student) ──
  const [takeOpen, setTakeOpen] = useState(false);
  const [takeTitle, setTakeTitle] = useState('');
  const [takeQs, setTakeQs] = useState<TakeQ[]>([]);
  const [takeAns, setTakeAns] = useState<Record<string, string[]>>({});
  const [takeResult, setTakeResult] = useState<{ score: number; maxScore: number } | null>(null);
  const [takeId, setTakeId] = useState<string | null>(null);
  const [takeBusy, setTakeBusy] = useState(false);

  async function openTake(id: string) {
    setTakeOpen(true); setTakeQs([]); setTakeAns({}); setTakeResult(null); setTakeId(id);
    const json = await (await fetch(`/api/v1/tests/${id}`)).json();
    if (json.success) {
      setTakeTitle(json.data.title);
      setTakeQs(json.data.questions);
      if (json.data.myAttempt) setTakeResult({ score: json.data.myAttempt.score, maxScore: json.data.myAttempt.maxScore });
    }
  }
  async function submitTake() {
    if (!takeId) return;
    setTakeBusy(true);
    try {
      const json = await (await fetch(`/api/v1/tests/${takeId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: takeAns }),
      })).json();
      if (json.success) { setTakeResult({ score: json.data.score, maxScore: json.data.maxScore }); load(); }
    } finally { setTakeBusy(false); }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap={8}><IconChecklist size={22} color="#5c7cfa" /><Title order={3} c="var(--mantine-color-text)">Тесты</Title></Group>
        {isStaff && <Button leftSection={<IconPlus size={16} />} color="bilimosBlue" onClick={() => setBOpen(true)}>Создать тест</Button>}
      </Group>

      {loading ? (
        <Group justify="center" p="xl"><Loader color="blue" /></Group>
      ) : rows.length === 0 ? (
        <Paper p="xl" radius="md" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}><Text c={SEC} ta="center">Тестов пока нет</Text></Paper>
      ) : (
        <Stack gap="sm">
          {rows.map((t) => (
            <Paper key={t.id} p="md" radius="md" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <Group justify="space-between">
                <div>
                  <Text fw={600} c="var(--mantine-color-text)">{t.title}</Text>
                  <Text size="xs" c={SEC}>{t.questionCount} вопрос(ов){isStaff ? ` · попыток: ${t.attemptCount ?? 0}` : ''}</Text>
                </div>
                {isStaff ? (
                  <Button size="xs" variant="light" onClick={() => openResults(t.id)}>Результаты</Button>
                ) : t.myAttempt ? (
                  <Badge variant="light" color="green" size="lg">{t.myAttempt.score} / {t.myAttempt.maxScore}</Badge>
                ) : (
                  <Button size="xs" color="bilimosBlue" onClick={() => openTake(t.id)}>Пройти</Button>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      {/* ── Конструктор теста ── */}
      <Modal opened={bOpen} onClose={() => setBOpen(false)} title="Новый тест" size="lg" centered>
        <Stack gap="sm">
          <TextInput label="Название теста" required value={bTitle} onChange={(e) => setBTitle(e.currentTarget.value)} />
          <Textarea label="Описание" value={bDesc} onChange={(e) => setBDesc(e.currentTarget.value)} autosize minRows={1} />
          {bQs.map((q, i) => (
            <Paper key={i} p="sm" radius="md" withBorder>
              <Group justify="space-between" mb={6}>
                <Text size="sm" fw={600}>Вопрос {i + 1}</Text>
                {bQs.length > 1 && <Button variant="subtle" color="red" size="xs" px={6} onClick={() => setBQs((qs) => qs.filter((_, j) => j !== i))}><IconTrash size={14} /></Button>}
              </Group>
              <Stack gap={6}>
                <TextInput placeholder="Текст вопроса" value={q.text} onChange={(e) => setQ(i, { text: e.currentTarget.value })} />
                <Group grow>
                  <Select data={QTYPES} value={q.type} onChange={(v) => setQ(i, { type: v ?? 'single', correct: [] })} size="xs" />
                  <NumberInput label={undefined} placeholder="Баллы" min={1} value={q.points} onChange={(v) => setQ(i, { points: Number(v) || 1 })} size="xs" w={90} />
                </Group>

                {(q.type === 'single' || q.type === 'multiple') && (
                  <Stack gap={4}>
                    {q.options.map((opt, oi) => (
                      <Group key={oi} gap={6} wrap="nowrap">
                        {q.type === 'single' ? (
                          <Radio checked={q.correct[0] === String(oi)} onChange={() => setQ(i, { correct: [String(oi)] })} />
                        ) : (
                          <Checkbox checked={q.correct.includes(String(oi))}
                            onChange={(e) => setQ(i, { correct: e.currentTarget.checked ? [...q.correct, String(oi)] : q.correct.filter((c) => c !== String(oi)) })} />
                        )}
                        <TextInput style={{ flex: 1 }} size="xs" placeholder={`Вариант ${oi + 1}`} value={opt}
                          onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === oi ? e.currentTarget.value : x)) })} />
                      </Group>
                    ))}
                    <Button variant="subtle" size="xs" onClick={() => setQ(i, { options: [...q.options, ''] })}>+ вариант</Button>
                    <Text size="xs" c={SEC}>Отметьте правильный(е) вариант(ы) слева.</Text>
                  </Stack>
                )}
                {q.type === 'number' && (
                  <TextInput size="xs" label="Правильный ответ (число)" value={q.numberValue} onChange={(e) => setQ(i, { numberValue: e.currentTarget.value })} />
                )}
              </Stack>
            </Paper>
          ))}
          <Button variant="light" size="xs" onClick={() => setBQs((qs) => [...qs, { text: '', type: 'single', options: ['', ''], correct: [], numberValue: '', points: 1 }])}>+ вопрос</Button>
          {bErr && <Text c="red" size="sm">{bErr}</Text>}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setBOpen(false)}>Отмена</Button>
            <Button onClick={saveTest} loading={bSaving} color="bilimosBlue">Создать тест</Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Результаты (staff) ── */}
      <Modal opened={resOpen} onClose={() => setResOpen(false)} title={resData?.title ?? 'Результаты'} centered>
        {!resData ? <Group justify="center" p="md"><Loader size="sm" /></Group> : resData.attemptList.length === 0 ? (
          <Text c={SEC} ta="center" py="md">Пока никто не проходил</Text>
        ) : (
          <ScrollArea>
            <Table><Table.Thead><Table.Tr><Table.Th>Ученик</Table.Th><Table.Th>Результат</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{resData.attemptList.map((a, i) => (
                <Table.Tr key={i}><Table.Td>{a.studentName}</Table.Td>
                  <Table.Td><Badge variant="light" color={a.score / Math.max(1, a.maxScore) >= 0.5 ? 'green' : 'red'}>{a.score} / {a.maxScore}</Badge></Table.Td>
                </Table.Tr>))}</Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Modal>

      {/* ── Прохождение (student) ── */}
      <Modal opened={takeOpen} onClose={() => setTakeOpen(false)} title={takeTitle} size="lg" centered>
        {takeResult ? (
          <Stack align="center" gap="sm" py="md">
            <Text size="xl" fw={700} c={takeResult.score / Math.max(1, takeResult.maxScore) >= 0.5 ? 'green' : 'red'}>
              {takeResult.score} / {takeResult.maxScore}
            </Text>
            <Text c={SEC}>Тест завершён. Автопроверка закрытых вопросов.</Text>
            <Button onClick={() => setTakeOpen(false)}>Закрыть</Button>
          </Stack>
        ) : (
          <Stack gap="md">
            {takeQs.map((q, i) => (
              <Paper key={q.id} p="sm" radius="md" withBorder>
                <Text size="sm" fw={600} mb={6}>{i + 1}. {q.text} <Text span c={SEC} size="xs">({q.points} б.)</Text></Text>
                {q.type === 'single' && (
                  <Radio.Group value={(takeAns[q.id] ?? [])[0] ?? ''} onChange={(v) => setTakeAns((a) => ({ ...a, [q.id]: [v] }))}>
                    <Stack gap={4}>{q.options.map((opt, oi) => <Radio key={oi} value={String(oi)} label={opt} />)}</Stack>
                  </Radio.Group>
                )}
                {q.type === 'multiple' && (
                  <Stack gap={4}>{q.options.map((opt, oi) => (
                    <Checkbox key={oi} label={opt} checked={(takeAns[q.id] ?? []).includes(String(oi))}
                      onChange={(e) => setTakeAns((a) => { const cur = a[q.id] ?? []; return { ...a, [q.id]: e.currentTarget.checked ? [...cur, String(oi)] : cur.filter((x) => x !== String(oi)) }; })} />
                  ))}</Stack>
                )}
                {q.type === 'number' && (
                  <TextInput size="xs" w={140} placeholder="Ответ" value={(takeAns[q.id] ?? [])[0] ?? ''} onChange={(e) => setTakeAns((a) => ({ ...a, [q.id]: [e.currentTarget.value] }))} />
                )}
                {q.type === 'text' && (
                  <Textarea size="xs" placeholder="Ваш ответ" value={(takeAns[q.id] ?? [])[0] ?? ''} onChange={(e) => setTakeAns((a) => ({ ...a, [q.id]: [e.currentTarget.value] }))} autosize minRows={1} />
                )}
              </Paper>
            ))}
            <Group justify="flex-end">
              <Button onClick={submitTake} loading={takeBusy} color="bilimosBlue">Сдать тест</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

export default function TestsPage() {
  return <RoleGate><Tests /></RoleGate>;
}
