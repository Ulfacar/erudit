'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Card, Group, Loader, Modal, NumberInput,
  Stack, Table, Text, Textarea, TextInput, Title,
} from '@mantine/core';
import {
  IconPlus, IconTrash, IconSparkles, IconDeviceFloppy, IconChalkboard, IconInfoCircle,
} from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface Stage { title: string; minutes: number; activity: string }
interface PlanListItem { id: string; title: string; date: string | null; duration: number; model: string | null }
interface PlanFull extends PlanListItem {
  subjectId: string | null; classId: string | null; objectives: string | null; stages: Stage[]; homework: string | null;
}

const empty = (): PlanFull => ({
  id: '', title: '', date: null, duration: 45, model: null,
  subjectId: null, classId: null, objectives: '', stages: [], homework: '',
});

function fmtDate(iso: string | null) {
  if (!iso) return 'без даты';
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }); } catch { return iso; }
}

function LessonPlans() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PlanListItem[]>([]);
  const [llmConfigured, setLlmConfigured] = useState(true);

  const [draft, setDraft] = useState<PlanFull | null>(null);
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/lesson-plans');
    const json = await res.json();
    if (json.success) { setItems(json.data.items); setLlmConfigured(json.data.llmConfigured); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setSubject(''); setGrade(''); setDraft(empty()); };

  const openEdit = useCallback(async (id: string) => {
    const res = await fetch(`/api/v1/lesson-plans/${id}`);
    const json = await res.json();
    if (json.success) {
      const d = json.data;
      setDraft({ ...d, objectives: d.objectives ?? '', homework: d.homework ?? '', stages: d.stages ?? [] });
    }
  }, []);

  const generate = useCallback(async () => {
    if (!draft || draft.title.trim().length < 3) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/v1/lesson-plans/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: draft.title, subject, gradeLevel: grade, duration: draft.duration }),
      });
      const json = await res.json();
      if (json.success) {
        setDraft((d) => d && ({ ...d, objectives: json.data.objectives, stages: json.data.stages, homework: json.data.homework, model: json.data.model }));
      }
    } finally {
      setGenerating(false);
    }
  }, [draft, subject, grade]);

  const save = useCallback(async () => {
    if (!draft || draft.title.trim().length < 2) return;
    setSaving(true);
    try {
      const payload = {
        title: draft.title, date: draft.date, duration: draft.duration,
        objectives: draft.objectives, stages: draft.stages, homework: draft.homework, model: draft.model,
      };
      if (draft.id) {
        await fetch(`/api/v1/lesson-plans/${draft.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await fetch('/api/v1/lesson-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      await load();
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }, [draft, load]);

  const remove = useCallback(async (id: string) => {
    await fetch(`/api/v1/lesson-plans/${id}`, { method: 'DELETE' });
    setDraft(null);
    setItems((p) => p.filter((x) => x.id !== id));
  }, []);

  const setStage = (i: number, patch: Partial<Stage>) =>
    setDraft((d) => d && ({ ...d, stages: d.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const addStage = () => setDraft((d) => d && ({ ...d, stages: [...d.stages, { title: '', minutes: 10, activity: '' }] }));
  const delStage = (i: number) => setDraft((d) => d && ({ ...d, stages: d.stages.filter((_, j) => j !== i) }));

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;

  const totalMin = draft?.stages.reduce((s, x) => s + (Number(x.minutes) || 0), 0) ?? 0;

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconChalkboard size={26} color="var(--mantine-color-blue-6)" />
          <div>
            <Title order={2}>Поурочные планы</Title>
            <Text c="dimmed" size="sm">План конкретного урока: цели, этапы со временем, ДЗ. С ИИ-черновиком.</Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={18} />} onClick={openNew}>Новый план</Button>
      </Group>

      {items.length === 0 ? (
        <Text c="dimmed" ta="center" py="lg">Планов уроков пока нет.</Text>
      ) : (
        <Stack gap="xs">
          {items.map((p) => (
            <Card key={p.id} withBorder radius="md" padding="sm" style={{ cursor: 'pointer' }} onClick={() => openEdit(p.id)}>
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>{p.title}</Text>
                  <Text size="xs" c="dimmed">{fmtDate(p.date)} · {p.duration} мин{p.model && p.model !== 'stub' ? ' · ИИ' : ''}</Text>
                </div>
                <ActionIcon variant="subtle" color="red" onClick={(e) => { e.stopPropagation(); remove(p.id); }}><IconTrash size={18} /></ActionIcon>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Modal opened={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Редактирование урока' : 'Новый план урока'} size="xl">
        {draft && (
          <Stack gap="sm">
            {!llmConfigured && (
              <Alert icon={<IconInfoCircle size={16} />} color="yellow" variant="light" py={6}>
                ИИ-ключ не настроен — генерация выдаёт демо-шаблон.
              </Alert>
            )}
            <TextInput label="Тема / название урока" placeholder="Напр.: Законы Ньютона" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })} required />
            <Group grow>
              <TextInput label="Предмет (для ИИ)" placeholder="Физика" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
              <TextInput label="Класс (для ИИ)" placeholder="8 класс" value={grade} onChange={(e) => setGrade(e.currentTarget.value)} />
              <TextInput label="Дата" type="date" value={draft.date ? draft.date.slice(0, 10) : ''} onChange={(e) => setDraft({ ...draft, date: e.currentTarget.value || null })} />
              <NumberInput label="Минут" min={5} max={120} value={draft.duration} onChange={(v) => setDraft({ ...draft, duration: Number(v) || 45 })} w={100} />
            </Group>

            <Group>
              <Button variant="light" color="grape" leftSection={<IconSparkles size={16} />} onClick={generate} loading={generating} disabled={draft.title.trim().length < 3}>
                Сгенерировать ИИ
              </Button>
              {draft.model && draft.model !== 'stub' && <Badge color="grape" variant="light">черновик ИИ</Badge>}
            </Group>

            <Textarea label="Цели урока" autosize minRows={2} value={draft.objectives ?? ''} onChange={(e) => setDraft({ ...draft, objectives: e.currentTarget.value })} />

            <div>
              <Group justify="space-between" mb={4}>
                <Text fw={600} size="sm">Этапы урока</Text>
                <Text size="xs" c={totalMin === draft.duration ? 'green' : 'dimmed'}>Σ {totalMin} / {draft.duration} мин</Text>
              </Group>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Этап</Table.Th>
                    <Table.Th style={{ width: 80 }}>Мин</Table.Th>
                    <Table.Th>Деятельность</Table.Th>
                    <Table.Th style={{ width: 40 }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {draft.stages.map((s, i) => (
                    <Table.Tr key={i}>
                      <Table.Td><TextInput size="xs" value={s.title} onChange={(e) => setStage(i, { title: e.currentTarget.value })} /></Table.Td>
                      <Table.Td><NumberInput size="xs" min={1} max={120} value={s.minutes} onChange={(v) => setStage(i, { minutes: Number(v) || 0 })} hideControls /></Table.Td>
                      <Table.Td><TextInput size="xs" value={s.activity} onChange={(e) => setStage(i, { activity: e.currentTarget.value })} /></Table.Td>
                      <Table.Td><ActionIcon size="sm" variant="subtle" color="red" onClick={() => delStage(i)}><IconTrash size={14} /></ActionIcon></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Button variant="light" size="xs" mt={6} leftSection={<IconPlus size={14} />} onClick={addStage}>Добавить этап</Button>
            </div>

            <Textarea label="Домашнее задание" autosize minRows={1} value={draft.homework ?? ''} onChange={(e) => setDraft({ ...draft, homework: e.currentTarget.value })} />

            <Group justify="space-between" mt="sm">
              {draft.id
                ? <Button color="red" variant="subtle" leftSection={<IconTrash size={16} />} onClick={() => remove(draft.id)}>Удалить</Button>
                : <span />}
              <Group>
                <Button variant="default" onClick={() => setDraft(null)}>Отмена</Button>
                <Button leftSection={<IconDeviceFloppy size={16} />} onClick={save} loading={saving} disabled={draft.title.trim().length < 2}>Сохранить</Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

export default function LessonPlansPage() {
  return (
    <RoleGate roles={['teacher', 'curator', 'zavuch', 'super_admin', 'analyst']}>
      <LessonPlans />
    </RoleGate>
  );
}
