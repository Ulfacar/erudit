'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon, Badge, Button, Group, Indicator, Loader, Menu, Modal, Paper, Select, Stack, Text, Textarea, TextInput, Title,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import { IconCalendarEvent, IconCheck, IconDots, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

interface Appt {
  id: string; at: string; kind: string; withType: string; withId: string | null; withName: string | null;
  topic: string; status: string; note: string | null; durationMin: number | null;
}

const KIND: Record<string, string> = { individual: 'Индивидуальная', personal: 'Личная', group: 'Групповая' };
const WITH: Record<string, string> = { student: 'Ученик', teacher: 'Учитель', parent: 'Родитель', seminar: 'Семинар' };
const STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Запланирована', color: 'blue' }, done: { label: 'Проведена', color: 'teal' }, cancelled: { label: 'Отменена', color: 'gray' },
};

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return localKey(d);
};
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

function PsyCalendar() {
  const [items, setItems] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>(() => localKey(new Date()));
  const [addOpen, setAddOpen] = useState(false);

  async function load() {
    const j = await fetch('/api/v1/psy/appointments').then((r) => r.json()).catch(() => ({ data: [] }));
    setItems(j.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, Appt[]>();
    for (const a of items) {
      const k = dayKey(a.at);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  }, [items]);

  const dayItems = (byDay.get(selected) ?? []).sort((a, b) => a.at.localeCompare(b.at));

  async function setStatus(id: string, status: string) {
    await fetch(`/api/v1/psy/appointments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    load();
  }
  async function remove(id: string) {
    if (!confirm('Удалить встречу?')) return;
    const res = await fetch(`/api/v1/psy/appointments/${id}`, { method: 'DELETE' });
    if (res.ok) { notifications.show({ color: 'green', title: 'Удалено', message: 'Встреча удалена' }); load(); }
  }

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs"><IconCalendarEvent size={24} color="#9c36b5" /><Title order={2}>Календарь психолога</Title></Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>Новая встреча</Button>
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
                return (
                  <Indicator size={7} color="grape" offset={-2} disabled={!byDay.has(k)}>
                    <div>{date.getDate()}</div>
                  </Indicator>
                );
              }}
            />
          </Paper>

          <Paper withBorder radius="md" p="md" style={{ flex: 1, minWidth: 300 }}>
            <Text fw={600} mb="sm">{fmtDate(selected)}</Text>
            {dayItems.length === 0 ? (
              <Text c="dimmed" size="sm">На этот день встреч нет.</Text>
            ) : (
              <Stack gap="sm">
                {dayItems.map((a) => (
                  <Paper key={a.id} withBorder radius="sm" p="sm">
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <div style={{ minWidth: 0 }}>
                        <Group gap={6}>
                          <Text fw={600}>{hhmm(a.at)}</Text>
                          <Text fw={500}>{a.topic}</Text>
                        </Group>
                        <Group gap={6} mt={4}>
                          <Badge size="xs" variant="light" color="grape">{KIND[a.kind] ?? a.kind}</Badge>
                          <Badge size="xs" variant="light" color="blue">{WITH[a.withType] ?? a.withType}{a.withName ? `: ${a.withName}` : ''}</Badge>
                          <Badge size="xs" variant="outline" color={STATUS[a.status]?.color}>{STATUS[a.status]?.label ?? a.status}</Badge>
                        </Group>
                        {a.note && <Text size="sm" c="dimmed" mt={4}>{a.note}</Text>}
                      </div>
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target><ActionIcon variant="subtle" color="gray"><IconDots size={16} /></ActionIcon></Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconCheck size={14} />} onClick={() => setStatus(a.id, 'done')}>Проведена</Menu.Item>
                          <Menu.Item leftSection={<IconX size={14} />} onClick={() => setStatus(a.id, 'cancelled')}>Отменить</Menu.Item>
                          <Menu.Divider />
                          <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(a.id)}>Удалить</Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Group>
      )}

      {addOpen && (
        <NewAppointmentModal
          defaultDay={selected}
          onClose={() => setAddOpen(false)}
          onDone={() => { setAddOpen(false); load(); }}
        />
      )}
    </Stack>
  );
}

interface Person { value: string; label: string }

function NewAppointmentModal({ defaultDay, onClose, onDone }: { defaultDay: string; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState('individual');
  const [withType, setWithType] = useState('student');
  const [withId, setWithId] = useState<string | null>(null);
  const [withNameText, setWithNameText] = useState('');
  const [at, setAt] = useState(`${defaultDay}T10:00`);
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [students, setStudents] = useState<Person[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/students').then((r) => r.json())
      .then((j) => setStudents((j.data ?? []).map((s: { id: string; firstName: string; lastName: string; class?: { grade: number; letter: string } | null }) =>
        ({ value: s.id, label: `${s.lastName} ${s.firstName}${s.class ? ` (${s.class.grade}${s.class.letter})` : ''}` }))))
      .catch(() => setStudents([]));
    fetch('/api/v1/teachers').then((r) => r.json())
      .then((j) => setTeachers((j.data ?? []).map((t: { id: string; firstName?: string; lastName?: string; fullName?: string }) =>
        ({ value: t.id, label: t.fullName ?? `${t.lastName ?? ''} ${t.firstName ?? ''}`.trim() }))))
      .catch(() => setTeachers([]));
  }, []);

  const personList = withType === 'student' ? students : withType === 'teacher' ? teachers : null;

  async function submit() {
    setErr('');
    if (!topic.trim()) { setErr('Укажите тему встречи'); return; }
    let wId: string | null = null;
    let wName: string | null = null;
    if (personList) {
      if (!withId) { setErr('Выберите, с кем встреча'); return; }
      wId = withId;
      wName = personList.find((p) => p.value === withId)?.label ?? null;
    } else {
      wName = withNameText.trim() || (withType === 'seminar' ? 'Семинар' : null);
    }
    setSaving(true);
    const res = await fetch('/api/v1/psy/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ at, kind, withType, withId: wId, withName: wName, topic, note: note || null }),
    });
    const j = await res.json(); setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    notifications.show({ color: 'green', title: 'Записано', message: 'Встреча добавлена в календарь' });
    onDone();
  }

  return (
    <Modal opened onClose={onClose} title="Новая встреча" centered>
      <Stack gap="sm">
        <Select label="Тип встречи" data={Object.entries(KIND).map(([v, l]) => ({ value: v, label: l }))} value={kind} onChange={(v) => setKind(v ?? 'individual')} />
        <Select label="С кем" data={Object.entries(WITH).map(([v, l]) => ({ value: v, label: l }))} value={withType}
          onChange={(v) => { setWithType(v ?? 'student'); setWithId(null); setWithNameText(''); }} />
        {personList ? (
          <Select label={withType === 'student' ? 'Ученик' : 'Учитель'} placeholder="Найти" searchable withAsterisk data={personList} value={withId} onChange={setWithId} />
        ) : (
          <TextInput label={withType === 'parent' ? 'Родитель (ФИО)' : 'Название семинара'} value={withNameText} onChange={(e) => setWithNameText(e.currentTarget.value)} />
        )}
        <TextInput label="Дата и время" type="datetime-local" value={at} onChange={(e) => setAt(e.currentTarget.value)} />
        <TextInput label="Тема встречи" required value={topic} onChange={(e) => setTopic(e.currentTarget.value)} />
        <Textarea label="Заметка (необязательно)" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        {err && <Text c="red" size="sm">{err}</Text>}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={saving}>Записать</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default function PsyCalendarPage() {
  return (
    <RoleGate roles={['psychologist', 'senior_psychologist', 'specialist', 'super_admin']}>
      <PsyCalendar />
    </RoleGate>
  );
}
