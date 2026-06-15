'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Card, Group, Loader, Modal, Select, Stack, Text, Textarea, Title } from '@mantine/core';
import { IconMessageCircle, IconPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

interface TalkMeta { withWhom?: string; parentResponse?: string }
interface Note { id: string; type: string; text: string; meta?: TalkMeta | null; role: string; createdAt: string }

const WITH_WHOM = [
  { value: 'student', label: 'С учеником' },
  { value: 'parent', label: 'С родителем' },
  { value: 'both', label: 'С учеником и родителем' },
];
const whomLabel = (v?: string) => WITH_WHOM.find((w) => w.value === v)?.label ?? 'Беседа';

/** Воспитательные беседы: записи бесед с учеником/родителями + ответ родителя (для завуча по воспитанию). */
export function StudentTalks({ studentId }: { studentId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch(`/api/v1/students/${studentId}/notes`).then((r) => r.json()).catch(() => ({ data: [] }));
    setNotes((j.data ?? []).filter((n: Note) => n.type === 'conversation'));
    setLoading(false);
  }, [studentId]);
  useEffect(() => { load(); }, [load]);

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <Title order={5}>Воспитательные беседы</Title>
        <Button size="sm" leftSection={<IconPlus size={16} />} onClick={() => setOpen(true)}>Добавить беседу</Button>
      </Group>

      {loading ? <Group justify="center" p="md"><Loader size="sm" /></Group>
        : notes.length === 0 ? <Text c="dimmed" size="sm">Бесед пока не зафиксировано.</Text>
        : (
          <Stack gap="sm">
            {notes.map((n) => (
              <Card key={n.id} withBorder radius="md" padding="sm">
                <Group gap="xs" mb={4}>
                  <Badge variant="light" color="grape" leftSection={<IconMessageCircle size={11} />}>{whomLabel(n.meta?.withWhom)}</Badge>
                  <Text size="xs" c="dimmed">{fmtDate(n.createdAt)}</Text>
                </Group>
                <Text size="sm">{n.text}</Text>
                {n.meta?.parentResponse && (
                  <Text size="sm" c="dimmed" mt={6}><b>Ответ родителя:</b> {n.meta.parentResponse}</Text>
                )}
              </Card>
            ))}
          </Stack>
        )}

      {open && <TalkModal studentId={studentId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </Stack>
  );
}

function TalkModal({ studentId, onClose, onDone }: { studentId: string; onClose: () => void; onDone: () => void }) {
  const [withWhom, setWithWhom] = useState('student');
  const [text, setText] = useState('');
  const [parentResponse, setParentResponse] = useState('');
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);

  async function submit() {
    if (!text.trim()) { setErr('Опишите содержание беседы'); return; }
    setSaving(true); setErr('');
    const res = await fetch(`/api/v1/students/${studentId}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'conversation', text, meta: { withWhom, parentResponse: parentResponse || undefined } }),
    });
    const j = await res.json(); setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    notifications.show({ color: 'green', title: 'Записано', message: 'Беседа добавлена' });
    onDone();
  }

  const showParent = withWhom === 'parent' || withWhom === 'both';

  return (
    <Modal opened onClose={onClose} title="Воспитательная беседа" centered>
      <Stack gap="sm">
        <Select label="С кем беседа" data={WITH_WHOM} value={withWhom} onChange={(v) => setWithWhom(v ?? 'student')} />
        <Textarea label="Содержание беседы" required autosize minRows={3} value={text} onChange={(e) => setText(e.currentTarget.value)} />
        {showParent && (
          <Textarea label="Ответ / реакция родителя" autosize minRows={2} value={parentResponse} onChange={(e) => setParentResponse(e.currentTarget.value)} />
        )}
        {err && <Text c="red" size="sm">{err}</Text>}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={saving}>Сохранить</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
