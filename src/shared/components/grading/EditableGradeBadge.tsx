'use client';

import { useState } from 'react';
import { Badge, Button, Group, NumberInput, Popover, Stack, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

export interface EditableGrade {
  id: string;
  value: number;
  category: { id: string; name: string; weight: number };
  editWindowExpired?: boolean;
}

/**
 * Бейдж оценки с правкой по клику. Учитель меняет значение в течение 24ч
 * (PUT /api/v1/grading/[id]); удаление — только завуч/админ (canDelete).
 */
export function EditableGradeBadge({
  grade, canDelete, onChanged,
}: {
  grade: EditableGrade;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [val, setVal] = useState<number | ''>(grade.value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const locked = grade.editWindowExpired && !canDelete; // учителю после 24ч править нельзя

  async function save() {
    if (val === '' || val === undefined) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/v1/grading/${grade.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: Number(val) }),
      });
      const json = await res.json();
      if (!json.success) { setErr(json.error?.message ?? 'Не удалось'); return; }
      setOpened(false); onChanged();
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/v1/grading/${grade.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) { setErr(json.error?.message ?? 'Не удалось удалить'); return; }
      setOpened(false); onChanged();
    } finally { setBusy(false); }
  }

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" withArrow shadow="md" trapFocus>
      <Popover.Target>
        <Badge
          variant="light" color="gray" radius="sm"
          style={{ cursor: 'pointer' }}
          onClick={() => { setVal(grade.value); setErr(null); setOpened((o) => !o); }}
          title={`${grade.category.name} ×${grade.category.weight}${locked ? ' · правка закрыта (24ч)' : ' · клик — изменить'}`}
        >
          {grade.value}{grade.category.weight > 1 ? `·${grade.category.weight}` : ''}
        </Badge>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" w={200}>
          <Text size="xs" c="dimmed">{grade.category.name} · вес ×{grade.category.weight}</Text>
          {locked ? (
            <Text size="sm" c="dimmed">Окно правки (24 ч) истекло. Изменить может завуч.</Text>
          ) : (
            <>
              <NumberInput size="xs" min={0} max={100} value={val} onChange={(v) => setVal(v as number)} hideControls autoFocus />
              {err && <Text size="xs" c="red">{err}</Text>}
              <Group justify="space-between">
                {canDelete
                  ? <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} loading={busy} onClick={remove}>Удалить</Button>
                  : <span />}
                <Button size="xs" loading={busy} onClick={save}>Сохранить</Button>
              </Group>
            </>
          )}
          {locked && canDelete && (
            <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} loading={busy} onClick={remove}>Удалить</Button>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
