'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Group, Loader, Modal, Paper, Stack, Text, Textarea, TextInput, Title,
} from '@mantine/core';
import { IconWritingSign, IconPlus, IconCheck, IconX } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useMe } from '@/shared/hooks/useMe';

const SURFACE = '#ffffff';
const BORDER = '#e6e9ee';
const SEC = 'var(--mantine-color-dimmed)';
const STAFF = ['super_admin', 'analyst', 'zavuch', 'secretary', 'curator'];

interface MyResp { studentId: string; signed: boolean; agreed: boolean | null }
interface Consent {
  id: string; title: string; description: string | null; eventDate: string | null;
  myResponses?: MyResp[]; agreedCount?: number; declinedCount?: number; total?: number;
}

function fmt(s: string | null) { return s ? new Date(s).toLocaleDateString('ru-RU') : '—'; }

function Consents() {
  const { me } = useMe();
  const isParent = me?.role === 'parent';
  const canCreate = me ? STAFF.includes(me.role) : false;
  const [rows, setRows] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/consents');
      const json = await res.json();
      if (json.success) setRows(json.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function childName(studentId: string) {
    const c = me?.children?.find((x) => x.studentId === studentId);
    return c ? `${c.lastName} ${c.firstName}` : 'ребёнок';
  }

  async function sign(consentId: string, studentId: string, agreed: boolean) {
    await fetch('/api/v1/consents/sign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consentId, studentId, agreed }),
    });
    load();
  }

  async function create() {
    if (!title) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/consents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: desc, eventDate: eventDate || null }),
      });
      const json = await res.json();
      if (json.success) { setOpen(false); setTitle(''); setDesc(''); setEventDate(''); load(); }
    } finally { setSaving(false); }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap={8}><IconWritingSign size={22} color="#0ca678" /><Title order={3} c="var(--mantine-color-text)">Согласия родителей</Title></Group>
        {canCreate && <Button leftSection={<IconPlus size={16} />} color="bilimosBlue" onClick={() => setOpen(true)}>Создать согласие</Button>}
      </Group>

      {loading ? (
        <Group justify="center" p="xl"><Loader color="blue" /></Group>
      ) : rows.length === 0 ? (
        <Paper p="xl" radius="md" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}><Text c={SEC} ta="center">Согласий пока нет</Text></Paper>
      ) : (
        <Stack gap="sm">
          {rows.map((c) => (
            <Paper key={c.id} p="md" radius="md" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <Group justify="space-between" mb={4}>
                <Text fw={600} c="var(--mantine-color-text)">{c.title}</Text>
                {c.eventDate && <Badge variant="light" color="teal">{fmt(c.eventDate)}</Badge>}
              </Group>
              {c.description && <Text size="sm" c={SEC} mb="sm">{c.description}</Text>}

              {isParent ? (
                <Stack gap={6}>
                  {(c.myResponses ?? []).map((r) => (
                    <Group key={r.studentId} justify="space-between">
                      <Text size="sm">{childName(r.studentId)}</Text>
                      {r.signed ? (
                        <Badge variant="light" color={r.agreed ? 'green' : 'red'}>{r.agreed ? 'Согласен' : 'Не согласен'}</Badge>
                      ) : (
                        <Group gap={4}>
                          <Button size="xs" variant="light" color="green" leftSection={<IconCheck size={14} />} onClick={() => sign(c.id, r.studentId, true)}>Согласен</Button>
                          <Button size="xs" variant="light" color="red" leftSection={<IconX size={14} />} onClick={() => sign(c.id, r.studentId, false)}>Нет</Button>
                        </Group>
                      )}
                    </Group>
                  ))}
                </Stack>
              ) : (
                <Group gap="md">
                  <Text size="sm" c="green">Согласны: {c.agreedCount ?? 0}</Text>
                  <Text size="sm" c="red">Отказ: {c.declinedCount ?? 0}</Text>
                  <Text size="sm" c={SEC}>Всего ответов: {c.total ?? 0}</Text>
                </Group>
              )}
            </Paper>
          ))}
        </Stack>
      )}

      <Modal opened={open} onClose={() => setOpen(false)} title="Новое согласие" centered>
        <Stack gap="sm">
          <TextInput label="Название" required value={title} onChange={(e) => setTitle(e.currentTarget.value)} placeholder="Экскурсия в музей" />
          <Textarea label="Описание" value={desc} onChange={(e) => setDesc(e.currentTarget.value)} autosize minRows={2} />
          <TextInput label="Дата мероприятия" type="date" value={eventDate} onChange={(e) => setEventDate(e.currentTarget.value)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={create} loading={saving} color="bilimosBlue">Создать</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function ConsentsPage() {
  return <RoleGate><Consents /></RoleGate>;
}
