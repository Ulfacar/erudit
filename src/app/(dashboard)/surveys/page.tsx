'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Group, Loader, Modal, Paper, Progress, Stack, Text, Textarea, TextInput, Title,
} from '@mantine/core';
import { IconChartBar, IconPlus, IconTrash } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useMe } from '@/shared/hooks/useMe';

const SURFACE = '#ffffff';
const BORDER = '#e6e9ee';
const SEC = 'var(--mantine-color-dimmed)';

interface Survey {
  id: string; title: string; description: string | null; options: string[];
  counts: number[]; total: number; myVote: number | null; closesAt: string | null;
}

const STAFF = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator'];

function Surveys() {
  const { me } = useMe();
  const canCreate = me ? STAFF.includes(me.role) : false;
  const [rows, setRows] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/surveys');
      const json = await res.json();
      if (json.success) setRows(json.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function vote(surveyId: string, optionIndex: number) {
    await fetch('/api/v1/surveys/vote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ surveyId, optionIndex }),
    });
    load();
  }

  async function create() {
    const opts = options.filter((o) => o.trim());
    if (!title || opts.length < 2) { setError('Заголовок и минимум 2 варианта'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/v1/surveys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: desc, options: opts, audience: [] }),
      });
      const json = await res.json();
      if (json.success) { setOpen(false); setTitle(''); setDesc(''); setOptions(['', '']); load(); }
      else setError(json.error?.message || 'Ошибка');
    } finally { setSaving(false); }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap={8}><IconChartBar size={22} color="#7048e8" /><Title order={3} c="var(--mantine-color-text)">Опросы</Title></Group>
        {canCreate && <Button leftSection={<IconPlus size={16} />} color="bilimosBlue" onClick={() => setOpen(true)}>Создать опрос</Button>}
      </Group>

      {loading ? (
        <Group justify="center" p="xl"><Loader color="blue" /></Group>
      ) : rows.length === 0 ? (
        <Paper p="xl" radius="md" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}><Text c={SEC} ta="center">Опросов пока нет</Text></Paper>
      ) : (
        <Stack gap="sm">
          {rows.map((s) => {
            const voted = s.myVote !== null;
            const closed = s.closesAt ? new Date(s.closesAt) < new Date() : false;
            const showResults = voted || closed;
            return (
              <Paper key={s.id} p="md" radius="md" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <Group justify="space-between" mb={6}>
                  <Text fw={600} c="var(--mantine-color-text)">{s.title}</Text>
                  <Badge variant="light" color="gray">{s.total} голос(ов)</Badge>
                </Group>
                {s.description && <Text size="sm" c={SEC} mb="sm">{s.description}</Text>}
                <Stack gap={8}>
                  {s.options.map((opt, i) => {
                    const pct = s.total ? Math.round((s.counts[i] / s.total) * 100) : 0;
                    if (showResults) {
                      return (
                        <div key={i}>
                          <Group justify="space-between" gap={4}>
                            <Text size="sm" c={s.myVote === i ? 'bilimosBlue' : 'var(--mantine-color-text)'} fw={s.myVote === i ? 600 : 400}>
                              {opt}{s.myVote === i ? ' ✓' : ''}
                            </Text>
                            <Text size="xs" c={SEC}>{pct}% · {s.counts[i]}</Text>
                          </Group>
                          <Progress value={pct} color={s.myVote === i ? 'blue' : 'gray'} size="sm" mt={2} />
                        </div>
                      );
                    }
                    return (
                      <Button key={i} variant="light" color="blue" justify="flex-start" onClick={() => vote(s.id, i)}>
                        {opt}
                      </Button>
                    );
                  })}
                </Stack>
                {closed && <Text size="xs" c="red" mt={6}>Опрос завершён</Text>}
              </Paper>
            );
          })}
        </Stack>
      )}

      <Modal opened={open} onClose={() => setOpen(false)} title="Новый опрос" centered>
        <Stack gap="sm">
          <TextInput label="Вопрос" required value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          <Textarea label="Описание (опц.)" value={desc} onChange={(e) => setDesc(e.currentTarget.value)} autosize minRows={1} />
          <Text size="sm" fw={500}>Варианты ответа</Text>
          {options.map((o, i) => (
            <Group key={i} gap={4} wrap="nowrap">
              <TextInput style={{ flex: 1 }} placeholder={`Вариант ${i + 1}`} value={o}
                onChange={(e) => setOptions((arr) => arr.map((x, j) => (j === i ? e.currentTarget.value : x)))} />
              {options.length > 2 && (
                <Button variant="subtle" color="red" px={6} onClick={() => setOptions((arr) => arr.filter((_, j) => j !== i))}><IconTrash size={16} /></Button>
              )}
            </Group>
          ))}
          <Button variant="subtle" size="xs" onClick={() => setOptions((arr) => [...arr, ''])}>+ вариант</Button>
          {error && <Text c="red" size="sm">{error}</Text>}
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={create} loading={saving} color="bilimosBlue">Создать</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function SurveysPage() {
  return <RoleGate><Surveys /></RoleGate>;
}
