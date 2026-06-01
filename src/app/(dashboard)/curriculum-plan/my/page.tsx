'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon, Badge, Button, Card, Group, Loader, Modal, NumberInput, Progress,
  Select, Stack, Table, Text, TextInput, Title,
} from '@mantine/core';
import {
  IconPlus, IconTrash, IconChevronUp, IconChevronDown, IconDeviceFloppy, IconNotebook,
} from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface Pair { subjectId: string; subjectName: string; subjectColor: string | null; classId: string; className: string }
interface Period { id: string; name: string; isActive: boolean }
interface PlanListItem {
  id: string; title: string; subjectName: string; subjectColor: string | null; className: string;
  topicsCount: number; topicsDone: number; hoursTotal: number;
}
interface Topic { title: string; hours: number; plannedAt: string | null; done: boolean }

function MyKtp() {
  const [loading, setLoading] = useState(true);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [plans, setPlans] = useState<PlanListItem[]>([]);

  // create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [pairKey, setPairKey] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // editor
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPlans = useCallback(async () => {
    const res = await fetch('/api/v1/curriculum-plan/plans');
    const json = await res.json();
    if (json.success) setPlans(json.data);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [optRes] = await Promise.all([fetch('/api/v1/curriculum-plan/options')]);
        const opt = await optRes.json();
        if (opt.success) {
          setPairs(opt.data.pairs);
          setPeriods(opt.data.periods);
          const active = opt.data.periods.find((p: Period) => p.isActive);
          setPeriodId(active?.id ?? opt.data.periods[0]?.id ?? null);
        }
        await loadPlans();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPlans]);

  const createPlan = useCallback(async () => {
    if (!pairKey || newTitle.trim().length < 2) return;
    const [subjectId, classId] = pairKey.split('|');
    setCreating(true);
    try {
      const res = await fetch('/api/v1/curriculum-plan/plans', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, classId, periodId, title: newTitle.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setCreateOpen(false);
        setNewTitle('');
        await loadPlans();
        openEditor(json.data.id);
      }
    } finally {
      setCreating(false);
    }
  }, [pairKey, newTitle, periodId, loadPlans]);

  const openEditor = useCallback(async (id: string) => {
    setEditId(id);
    setEditLoading(true);
    try {
      const res = await fetch(`/api/v1/curriculum-plan/plans/${id}`);
      const json = await res.json();
      if (json.success) {
        setEditTitle(json.data.title);
        setTopics((json.data.topics ?? []).map((t: { title: string; hours: number; plannedAt: string | null; done: boolean }) => ({
          title: t.title, hours: t.hours, plannedAt: t.plannedAt ? t.plannedAt.slice(0, 10) : null, done: t.done,
        })));
      }
    } finally {
      setEditLoading(false);
    }
  }, []);

  const savePlan = useCallback(async () => {
    if (!editId) return;
    setSaving(true);
    try {
      await fetch(`/api/v1/curriculum-plan/plans/${editId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, topics }),
      });
      await loadPlans();
      setEditId(null);
    } finally {
      setSaving(false);
    }
  }, [editId, editTitle, topics, loadPlans]);

  const deletePlan = useCallback(async (id: string) => {
    await fetch(`/api/v1/curriculum-plan/plans/${id}`, { method: 'DELETE' });
    setEditId(null);
    setPlans((p) => p.filter((x) => x.id !== id));
  }, []);

  // topic helpers
  const setTopic = (i: number, patch: Partial<Topic>) =>
    setTopics((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const addTopic = () => setTopics((ts) => [...ts, { title: '', hours: 1, plannedAt: null, done: false }]);
  const delTopic = (i: number) => setTopics((ts) => ts.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) =>
    setTopics((ts) => {
      const j = i + dir;
      if (j < 0 || j >= ts.length) return ts;
      const copy = [...ts];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;

  const pairOptions = pairs.map((p) => ({ value: `${p.subjectId}|${p.classId}`, label: `${p.className} · ${p.subjectName}` }));
  const periodOptions = periods.map((p) => ({ value: p.id, label: p.name }));

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconNotebook size={26} color="var(--mantine-color-blue-6)" />
          <div>
            <Title order={2}>Моё КТП</Title>
            <Text c="dimmed" size="sm">Календарно-тематическое планирование по вашим предметам</Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={18} />} onClick={() => setCreateOpen(true)} disabled={pairs.length === 0}>
          Новый план
        </Button>
      </Group>

      {pairs.length === 0 && (
        <Text c="dimmed">Нет назначенных предметов/классов — обратитесь к завучу.</Text>
      )}

      {plans.length === 0 ? (
        <Text c="dimmed" ta="center" py="lg">Планов пока нет — создайте первый.</Text>
      ) : (
        <Stack gap="xs">
          {plans.map((p) => {
            const pct = p.topicsCount ? Math.round((p.topicsDone / p.topicsCount) * 100) : 0;
            return (
              <Card key={p.id} withBorder radius="md" padding="sm" style={{ cursor: 'pointer' }} onClick={() => openEditor(p.id)}>
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs">
                      <Badge variant="light" color="blue">{p.className}</Badge>
                      <Text fw={600} truncate>{p.subjectName} — {p.title}</Text>
                    </Group>
                    <Group gap="md" mt={6}>
                      <Text size="xs" c="dimmed">{p.topicsCount} тем · {p.hoursTotal} ч</Text>
                      <Text size="xs" c="dimmed">пройдено {p.topicsDone}/{p.topicsCount}</Text>
                    </Group>
                    <Progress value={pct} size="sm" mt={6} color={pct === 100 ? 'green' : 'blue'} />
                  </div>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Создание плана */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Новый план КТП">
        <Stack gap="sm">
          <Select label="Предмет и класс" data={pairOptions} value={pairKey} onChange={setPairKey} searchable required />
          <Select label="Учебный период" data={periodOptions} value={periodId} onChange={setPeriodId} />
          <TextInput label="Название плана" placeholder="Напр.: Алгебра, 3 триместр" value={newTitle} onChange={(e) => setNewTitle(e.currentTarget.value)} required />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button onClick={createPlan} loading={creating} disabled={!pairKey || newTitle.trim().length < 2}>Создать</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Редактор тем */}
      <Modal opened={!!editId} onClose={() => setEditId(null)} title="Редактор плана" size="xl">
        {editLoading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : (
          <Stack gap="sm">
            <TextInput label="Название плана" value={editTitle} onChange={(e) => setEditTitle(e.currentTarget.value)} />
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 36 }}>#</Table.Th>
                  <Table.Th>Тема</Table.Th>
                  <Table.Th style={{ width: 80 }}>Часы</Table.Th>
                  <Table.Th style={{ width: 150 }}>Дата</Table.Th>
                  <Table.Th style={{ width: 70 }}>Готово</Table.Th>
                  <Table.Th style={{ width: 90 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {topics.map((t, i) => (
                  <Table.Tr key={i}>
                    <Table.Td><Text size="sm" c="dimmed">{i + 1}</Text></Table.Td>
                    <Table.Td>
                      <TextInput size="xs" value={t.title} placeholder="Название темы" onChange={(e) => setTopic(i, { title: e.currentTarget.value })} />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" min={0} max={999} value={t.hours} onChange={(v) => setTopic(i, { hours: Number(v) || 0 })} hideControls />
                    </Table.Td>
                    <Table.Td>
                      <TextInput size="xs" type="date" value={t.plannedAt ?? ''} onChange={(e) => setTopic(i, { plannedAt: e.currentTarget.value || null })} />
                    </Table.Td>
                    <Table.Td>
                      <Button size="compact-xs" variant={t.done ? 'filled' : 'default'} color="green" onClick={() => setTopic(i, { done: !t.done })}>
                        {t.done ? '✓' : '—'}
                      </Button>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={2} wrap="nowrap">
                        <ActionIcon size="sm" variant="subtle" onClick={() => move(i, -1)} disabled={i === 0}><IconChevronUp size={14} /></ActionIcon>
                        <ActionIcon size="sm" variant="subtle" onClick={() => move(i, 1)} disabled={i === topics.length - 1}><IconChevronDown size={14} /></ActionIcon>
                        <ActionIcon size="sm" variant="subtle" color="red" onClick={() => delTopic(i)}><IconTrash size={14} /></ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addTopic} size="xs">Добавить тему</Button>

            <Group justify="space-between" mt="sm">
              <Button color="red" variant="subtle" leftSection={<IconTrash size={16} />} onClick={() => editId && deletePlan(editId)}>
                Удалить план
              </Button>
              <Group>
                <Button variant="default" onClick={() => setEditId(null)}>Закрыть</Button>
                <Button leftSection={<IconDeviceFloppy size={16} />} onClick={savePlan} loading={saving}>Сохранить</Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

export default function MyKtpPage() {
  return (
    <RoleGate roles={['teacher', 'curator', 'zavuch', 'super_admin', 'analyst']}>
      <MyKtp />
    </RoleGate>
  );
}
