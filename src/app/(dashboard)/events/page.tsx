'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon, Button, Group, Indicator, Loader, Modal, Paper, Stack, Text, Textarea, TextInput, Title,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import { IconConfetti, IconMapPin, IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useRole } from '@/shared/hooks/useRole';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

interface SchoolEvent {
  id: string; title: string; description?: string | null; date: string; endDate?: string | null; location?: string | null;
}

const dayKey = (iso: string) => iso.slice(0, 10);
const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function EventsCalendar() {
  const { has } = useRole();
  const canEdit = has('super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator');
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>(() => localKey(new Date()));
  const [addOpen, setAddOpen] = useState(false);

  async function load() {
    const j = await fetch('/api/v1/events').then((r) => r.json()).catch(() => ({ data: [] }));
    setEvents(j.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, SchoolEvent[]>();
    for (const e of events) {
      const k = dayKey(e.date);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  }, [events]);

  const selectedEvents = byDay.get(selected) ?? [];

  async function remove(id: string) {
    if (!confirm('Удалить мероприятие?')) return;
    const res = await fetch(`/api/v1/events?id=${id}`, { method: 'DELETE' });
    if (res.ok) { notifications.show({ color: 'green', title: 'Удалено', message: 'Мероприятие удалено' }); load(); }
  }

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs"><IconConfetti size={24} color="#e64980" /><Title order={2}>Мероприятия школы</Title></Group>
        {canEdit && <Button leftSection={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>Добавить мероприятие</Button>}
      </Group>

      {loading ? <Group justify="center" p="xl"><Loader /></Group> : (
        <Group align="flex-start" gap="xl" wrap="wrap">
          <Paper withBorder radius="md" p="md">
            <Calendar
              size="lg"
              getDayProps={(date) => {
                const k = localKey(date);
                return { selected: k === selected, onClick: () => setSelected(k) };
              }}
              renderDay={(date) => {
                const k = localKey(date);
                const has = byDay.has(k);
                return (
                  <Indicator size={7} color="pink" offset={-2} disabled={!has}>
                    <div>{date.getDate()}</div>
                  </Indicator>
                );
              }}
            />
          </Paper>

          <Paper withBorder radius="md" p="md" style={{ flex: 1, minWidth: 280 }}>
            <Text fw={600} mb="sm">{fmtDate(selected)}</Text>
            {selectedEvents.length === 0 ? (
              <Text c="dimmed" size="sm">На этот день мероприятий нет.</Text>
            ) : (
              <Stack gap="sm">
                {selectedEvents.map((e) => (
                  <Paper key={e.id} withBorder radius="sm" p="sm">
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <div>
                        <Text fw={500}>{e.title}</Text>
                        {e.location && <Group gap={4} mt={2}><IconMapPin size={12} /><Text size="xs" c="dimmed">{e.location}</Text></Group>}
                        {e.endDate && <Text size="xs" c="dimmed">по {fmtDate(e.endDate)}</Text>}
                        {e.description && <Text size="sm" mt={4}>{e.description}</Text>}
                      </div>
                      {canEdit && <ActionIcon variant="subtle" color="red" onClick={() => remove(e.id)}><IconTrash size={16} /></ActionIcon>}
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Group>
      )}

      {addOpen && <AddEventModal defaultDate={selected} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); load(); }} />}
    </Stack>
  );
}

function AddEventModal({ defaultDate, onClose, onDone }: { defaultDate: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: '', date: defaultDate, endDate: '', location: '', description: '' });
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!f.title.trim() || !f.date) { setErr('Укажите название и дату'); return; }
    setSaving(true); setErr('');
    const res = await fetch('/api/v1/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: f.title, date: f.date, endDate: f.endDate || null, location: f.location || null, description: f.description || null }),
    });
    const j = await res.json(); setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    onDone();
  }

  return (
    <Modal opened onClose={onClose} title="Новое мероприятие" centered>
      <Stack gap="sm">
        <TextInput label="Название" required value={f.title} onChange={(e) => set('title', e.currentTarget.value)} />
        <Group grow>
          <TextInput label="Дата" type="date" required value={f.date} onChange={(e) => set('date', e.currentTarget.value)} />
          <TextInput label="Дата окончания" type="date" value={f.endDate} onChange={(e) => set('endDate', e.currentTarget.value)} />
        </Group>
        <TextInput label="Место проведения" value={f.location} onChange={(e) => set('location', e.currentTarget.value)} />
        <Textarea label="Описание" autosize minRows={2} value={f.description} onChange={(e) => set('description', e.currentTarget.value)} />
        {err && <Text c="red" size="sm">{err}</Text>}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={saving}>Создать</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default function EventsPage() {
  return (
    <RoleGate>
      <EventsCalendar />
    </RoleGate>
  );
}
