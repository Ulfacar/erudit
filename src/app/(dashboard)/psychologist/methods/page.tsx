'use client';

import { useEffect, useState } from 'react';
import {
  ActionIcon, Badge, Button, Card, Group, Loader, Modal, NumberInput, Paper, Select, Stack,
  Text, TextInput, Title,
} from '@mantine/core';
import { IconCheck, IconCopy, IconEdit, IconPlus, IconTool, IconTrash } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useMe } from '@/shared/hooks/useMe';
import { useRole } from '@/shared/hooks/useRole';

interface Question { text: string; type: 'scale' | 'text' | 'symptom' | 'file' }
interface Schema { metric?: string; scaleMin?: number; scaleMax?: number; questions?: Question[] }
interface Template {
  id: string; name: string; version: number; parentTemplateId: string | null;
  isActive: boolean; isBase: boolean; isPublished: boolean; authorId: string | null;
  schema: Schema; mappingRule: { op?: string; factor?: number } | null;
}

const QTYPE = { scale: 'Шкала', text: 'Текст', symptom: 'Симптом', file: 'Загрузка файла' };
const CREATE_ROLES = ['psychologist', 'senior_psychologist', 'specialist'];
const MANAGE_ROLES = ['senior_psychologist', 'super_admin'];

function Constructor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Template | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const { role } = useRole();
  const { me } = useMe();

  const userId = me?.id ?? null;
  const canCreate = role ? CREATE_ROLES.includes(role) : false;
  const canManage = role ? MANAGE_ROLES.includes(role) : false;

  async function load() {
    setLoading(true);
    const j = await fetch('/api/v1/psy/templates').then((r) => r.json()).catch(() => ({ data: [] }));
    setTemplates(j.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function mutate(id: string, request: () => Promise<Response>) {
    setMutatingId(id);
    try {
      await request();
      await load();
    } finally {
      setMutatingId(null);
    }
  }

  function copyTemplate(id: string) {
    return mutate(id, () => fetch(`/api/v1/psy/templates/${id}/copy`, { method: 'POST' }));
  }

  function publishTemplate(id: string) {
    return mutate(id, () => fetch('/api/v1/psy/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, publish: true }),
    }));
  }

  function deleteTemplate(id: string) {
    return mutate(id, () => fetch(`/api/v1/psy/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' }));
  }

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs"><IconTool size={26} color="#7048e8" /><Title order={2}>Конструктор методик</Title></Group>
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>Создать методику</Button>}
      </Group>
      <Text c="dimmed" size="sm">Соберите тест за 5 минут (вопросы, шкалы 1-10, симптомы). Номер версии сохраняется у каждой методики.</Text>

      {loading ? <Group justify="center" p="xl"><Loader /></Group>
        : templates.length === 0 ? <Text c="dimmed" ta="center" py="xl">Методик пока нет.</Text>
        : (
          <Stack gap="md">
            {templates.map((template) => {
              const isMine = userId !== null && template.authorId === userId;
              const canCopy = template.isBase || (template.isPublished && !isMine);
              const canEdit = !template.isBase && isMine;
              const canDelete = !template.isBase && (canManage || (isMine && !template.isPublished));
              const canPublish = canManage && !template.isBase && !template.isPublished;

              return (
                <Card key={template.id} withBorder radius="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Group gap="xs">
                        <Text fw={600}>{template.name}</Text>
                        <Badge variant="light" color="grape">v{template.version}</Badge>
                        {template.isBase && <Badge color="gray">Базовая</Badge>}
                        {template.isPublished && <Badge color="green">Опубликована</Badge>}
                        {!template.isBase && !template.isPublished && isMine && <Badge color="blue">Моя (черновик)</Badge>}
                      </Group>
                      <Text size="sm" c="dimmed" mt={4}>
                        Метрика: {template.schema.metric ?? '—'} · шкала {template.schema.scaleMin ?? 1}-{template.schema.scaleMax ?? 10} · вопросов: {template.schema.questions?.length ?? 0}
                      </Text>
                      {template.mappingRule?.op && <Text size="xs" c="teal">Mapping: {template.mappingRule.op} x {template.mappingRule.factor}</Text>}
                    </div>
                    <Group gap="xs" justify="flex-end">
                      {canCopy && (
                        <Button size="xs" variant="light" leftSection={<IconCopy size={14} />} loading={mutatingId === template.id} onClick={() => copyTemplate(template.id)}>
                          Копировать
                        </Button>
                      )}
                      {canEdit && (
                        <Button size="xs" variant="light" leftSection={<IconEdit size={14} />} onClick={() => setEditOpen(template)}>
                          Редактировать
                        </Button>
                      )}
                      {canPublish && (
                        <Button size="xs" variant="light" color="green" leftSection={<IconCheck size={14} />} loading={mutatingId === template.id} onClick={() => publishTemplate(template.id)}>
                          Опубликовать
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />} loading={mutatingId === template.id} onClick={() => deleteTemplate(template.id)}>
                          Удалить
                        </Button>
                      )}
                    </Group>
                  </Group>
                </Card>
              );
            })}
          </Stack>
        )}

      <CreateModal opened={createOpen} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load(); }} />
      {editOpen && <EditModal source={editOpen} onClose={() => setEditOpen(null)} onDone={() => { setEditOpen(null); load(); }} />}
    </Stack>
  );
}

function QuestionEditor({ questions, setQuestions }: { questions: Question[]; setQuestions: (q: Question[]) => void }) {
  return (
    <Stack gap="xs">
      {questions.map((q, i) => (
        <Group key={i} gap="xs" wrap="nowrap">
          <TextInput style={{ flex: 1 }} placeholder="Текст вопроса" value={q.text}
            onChange={(e) => setQuestions(questions.map((x, j) => j === i ? { ...x, text: e.currentTarget.value } : x))} />
          <Select w={150} data={Object.entries(QTYPE).map(([v, l]) => ({ value: v, label: l }))} value={q.type}
            onChange={(v) => setQuestions(questions.map((x, j) => j === i ? { ...x, type: (v as Question['type']) } : x))} />
          <ActionIcon color="red" variant="light" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}><IconTrash size={16} /></ActionIcon>
        </Group>
      ))}
      <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={() => setQuestions([...questions, { text: '', type: 'scale' }])}>Добавить вопрос</Button>
    </Stack>
  );
}

function CreateModal({ opened, onClose, onDone }: { opened: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [metric, setMetric] = useState('');
  const [scaleMin, setScaleMin] = useState<number>(1);
  const [scaleMax, setScaleMax] = useState<number>(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) { setErr('Нужно название'); return; }
    setSaving(true); setErr('');
    const res = await fetch('/api/v1/psy/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, metric, scaleMin, scaleMax, questions: questions.filter((q) => q.text.trim()) }) });
    const j = await res.json(); setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    setName(''); setMetric(''); setScaleMin(1); setScaleMax(10); setQuestions([]); onDone();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Новая методика" centered size="lg">
      <Stack gap="md">
        <TextInput label="Название" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Измеряемая метрика" placeholder="напр.: тревожность" value={metric} onChange={(e) => setMetric(e.currentTarget.value)} />
        <Group grow>
          <NumberInput label="Шкала от" value={scaleMin} onChange={(v) => setScaleMin(Number(v) || 0)} />
          <NumberInput label="Шкала до" value={scaleMax} onChange={(v) => setScaleMax(Number(v) || 0)} />
        </Group>
        <div><Text size="sm" fw={500} mb={4}>Вопросы</Text><QuestionEditor questions={questions} setQuestions={setQuestions} /></div>
        {err && <Text c="red" size="sm">{err}</Text>}
        <Group justify="flex-end"><Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button><Button onClick={submit} loading={saving}>Создать</Button></Group>
      </Stack>
    </Modal>
  );
}

function EditModal({ source, onClose, onDone }: { source: Template; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(source.name);
  const [metric, setMetric] = useState(source.schema.metric ?? '');
  const [scaleMin, setScaleMin] = useState<number>(source.schema.scaleMin ?? 1);
  const [scaleMax, setScaleMax] = useState<number>(source.schema.scaleMax ?? 10);
  const [questions, setQuestions] = useState<Question[]>(source.schema.questions ?? []);
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) { setErr('Нужно название'); return; }
    setSaving(true); setErr('');
    const schema = { ...source.schema, metric, scaleMin, scaleMax, questions: questions.filter((q) => q.text.trim()) };
    const res = await fetch('/api/v1/psy/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: source.id, name, schema }),
    });
    const j = await res.json(); setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    onDone();
  }

  return (
    <Modal opened onClose={onClose} title={`Редактировать: ${source.name} (v${source.version})`} centered size="lg">
      <Stack gap="md">
        <TextInput label="Название" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Измеряемая метрика" placeholder="напр.: тревожность" value={metric} onChange={(e) => setMetric(e.currentTarget.value)} />
        <Group grow>
          <NumberInput label="Шкала от" value={scaleMin} onChange={(v) => setScaleMin(Number(v) || 0)} />
          <NumberInput label="Шкала до" value={scaleMax} onChange={(v) => setScaleMax(Number(v) || 0)} />
        </Group>
        <Paper withBorder p="sm" radius="sm">
          <Text size="sm" fw={500} mb={4}>Вопросы</Text>
          <QuestionEditor questions={questions} setQuestions={setQuestions} />
        </Paper>
        {err && <Text c="red" size="sm">{err}</Text>}
        <Group justify="flex-end"><Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button><Button onClick={submit} loading={saving}>Сохранить</Button></Group>
      </Stack>
    </Modal>
  );
}

export default function ConstructorPage() {
  return (
    <RoleGate roles={['psychologist', 'senior_psychologist', 'psy_coordinator', 'specialist', 'super_admin']}>
      <Constructor />
    </RoleGate>
  );
}
