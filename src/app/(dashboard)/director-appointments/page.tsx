'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Card, Group, Loader, Modal, Paper, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { IconCalendarUser, IconCheck, IconPlus, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useRole } from '@/shared/hooks/useRole';

interface Appt {
  id: string; topic: string; studentName: string | null; desiredAt: string; note: string | null;
  status: 'pending' | 'confirmed' | 'declined'; createdAt: string;
}
const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает', color: 'orange' },
  confirmed: { label: 'Подтверждено', color: 'green' },
  declined: { label: 'Отклонено', color: 'red' },
};
const fmtDT = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function DirectorAppointments() {
  const { has } = useRole();
  const isDirector = has('super_admin', 'analyst', 'zavuch');
  const [rows, setRows] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch('/api/v1/director-appointments').then((r) => r.json()).catch(() => ({ data: [] }));
    setRows(j.data ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(id: string, status: 'confirmed' | 'declined') {
    const res = await fetch('/api/v1/director-appointments', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }),
    });
    if (res.ok) { notifications.show({ color: 'green', title: 'Готово', message: status === 'confirmed' ? 'Подтверждено' : 'Отклонено' }); load(); }
  }

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs"><IconCalendarUser size={24} color="#4263eb" /><Title order={2}>Запись к директору</Title></Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpen(true)}>Записать на встречу</Button>
      </Group>

      <Paper withBorder p="md" radius="md">
        {loading ? <Group justify="center" p="xl"><Loader /></Group>
          : rows.length === 0 ? <Text c="dimmed" ta="center" py="xl">Записей нет.</Text>
          : (
            <Stack gap="sm">
              {rows.map((a) => (
                <Card key={a.id} withBorder radius="md" padding="sm">
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <div>
                      <Group gap="xs">
                        <Text fw={600}>{a.topic}</Text>
                        <Badge color={STATUS[a.status]?.color} variant="light">{STATUS[a.status]?.label}</Badge>
                      </Group>
                      <Text size="sm" c="dimmed">{fmtDT(a.desiredAt)}{a.studentName ? ` · ${a.studentName}` : ''}</Text>
                      {a.note && <Text size="sm" mt={4}>{a.note}</Text>}
                    </div>
                    {isDirector && a.status === 'pending' && (
                      <Group gap={6} wrap="nowrap">
                        <Button size="compact-xs" color="green" variant="light" leftSection={<IconCheck size={13} />} onClick={() => decide(a.id, 'confirmed')}>Подтвердить</Button>
                        <Button size="compact-xs" color="red" variant="subtle" leftSection={<IconX size={13} />} onClick={() => decide(a.id, 'declined')}>Отклонить</Button>
                      </Group>
                    )}
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
      </Paper>

      {open && <ApptModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </Stack>
  );
}

function ApptModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [topic, setTopic] = useState('');
  const [studentName, setStudentName] = useState('');
  const [desiredAt, setDesiredAt] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);

  async function submit() {
    if (!topic.trim() || !desiredAt) { setErr('Укажите тему и дату/время'); return; }
    setSaving(true); setErr('');
    const res = await fetch('/api/v1/director-appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, studentName: studentName || null, desiredAt, note: note || null }),
    });
    const j = await res.json(); setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    onDone();
  }

  return (
    <Modal opened onClose={onClose} title="Запись на встречу с директором" centered>
      <Stack gap="sm">
        <TextInput label="Тема встречи" required value={topic} onChange={(e) => setTopic(e.currentTarget.value)} />
        <TextInput label="По ученику (необязательно)" value={studentName} onChange={(e) => setStudentName(e.currentTarget.value)} />
        <TextInput label="Желаемые дата и время" type="datetime-local" required value={desiredAt} onChange={(e) => setDesiredAt(e.currentTarget.value)} />
        <Textarea label="Комментарий" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        {err && <Text c="red" size="sm">{err}</Text>}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={saving}>Записать</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default function DirectorAppointmentsPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <DirectorAppointments />
    </RoleGate>
  );
}
