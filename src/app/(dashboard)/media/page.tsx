'use client';

import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Modal, Select, Stack, TextInput, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconEdit, IconPlayerPlay, IconVideo } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { TelegramQrPrint } from '@/shared/components/telegram/TelegramQrPrint';
import { ResourcePage, type ResourceRow } from '@/shared/components/ui/ResourcePage';
import { fmtDate } from '@/shared/components/ui/resource-helpers';
import { useRole } from '@/shared/hooks/useRole';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'event_manager', 'media'] as const;
const MANAGE_ROLES = ['super_admin', 'analyst', 'media'] as const;

const PRIORITY = [
  { value: 'high', label: 'Высокий' },
  { value: 'medium', label: 'Средний' },
  { value: 'low', label: 'Низкий' },
];

const STATUS = [
  { value: 'open', label: 'Открыта' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Готово' },
  { value: 'cancelled', label: 'Отменена' },
];

const STATUS_TABS = [
  { value: 'all', label: 'Все' },
  { value: 'open', label: 'Открытые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Готовые' },
];

const PR_COLOR: Record<string, string> = { high: 'red', medium: 'yellow', low: 'gray' };
const ST_COLOR: Record<string, string> = { open: 'blue', in_progress: 'orange', done: 'green', cancelled: 'gray' };

function ManageMediaRequest({ row, reload }: { row: ResourceRow; reload: () => void }) {
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(String(row.status ?? 'open'));
  const [assigneeName, setAssigneeName] = useState(String(row.assigneeName ?? ''));

  async function patch(next: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/v1/media-requests/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!json.success) {
      notifications.show({ color: 'red', title: 'Ошибка', message: json.error?.message ?? 'Не удалось обновить заявку' });
      return;
    }
    notifications.show({ color: 'green', title: 'Сохранено', message: 'Заявка обновлена' });
    setOpened(false);
    reload();
  }

  return (
    <>
      <Tooltip label="В работу">
        <ActionIcon variant="subtle" color="orange" loading={saving} onClick={() => patch({ status: 'in_progress' })}>
          <IconPlayerPlay size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Готово">
        <ActionIcon variant="subtle" color="green" loading={saving} onClick={() => patch({ status: 'done' })}>
          <IconCheck size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Изменить">
        <ActionIcon variant="subtle" color="blue" onClick={() => setOpened(true)}>
          <IconEdit size={16} />
        </ActionIcon>
      </Tooltip>

      <Modal opened={opened} onClose={() => setOpened(false)} title="Медиа-заявка" centered>
        <Stack gap="sm">
          <Select label="Статус" data={STATUS} value={status} onChange={(v) => setStatus(v ?? 'open')} />
          <TextInput label="Ответственный" value={assigneeName} onChange={(e) => setAssigneeName(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setOpened(false)}>Отмена</Button>
            <Button
              loading={saving}
              onClick={() => patch({ status, assigneeName: assigneeName.trim() || null })}
            >
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function MediaContent() {
  const { has } = useRole();
  const canManage = has(...MANAGE_ROLES);
  const [tab, setTab] = useState('all');
  const query = tab === 'all' ? undefined : { status: tab };

  return (
    <Stack gap="md">
      <Group gap="xs">
        {STATUS_TABS.map((item) => (
          <Button
            key={item.value}
            size="xs"
            variant={tab === item.value ? 'filled' : 'light'}
            color={tab === item.value ? 'eruditBlue' : 'gray'}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </Group>
      <TelegramQrPrint mode="film" label="QR для съемки" />
      <ResourcePage
        title="Медиа-центр"
        icon={<IconVideo size={22} color="#868e96" />}
        endpoint="/api/v1/media-requests"
        query={query}
        createLabel="Новая заявка"
        searchable
        columns={[
          { key: 'title', label: 'Заявка' },
          { key: 'source', label: 'Источник', render: (r) => (r.source === 'event' ? <Badge variant="light" color="pink" radius="sm">мероприятие</Badge> : '—') },
          { key: 'location', label: 'Место' },
          { key: 'date', label: 'Дата', render: (r) => (r.date ? fmtDate(String(r.date)) : '—') },
          { key: 'priority', label: 'Приоритет', render: (r) => <Badge variant="light" color={PR_COLOR[String(r.priority)] ?? 'gray'} radius="sm">{PRIORITY.find((p) => p.value === r.priority)?.label ?? String(r.priority)}</Badge> },
          { key: 'status', label: 'Статус', render: (r) => <Badge variant="light" color={ST_COLOR[String(r.status)] ?? 'gray'} radius="sm">{STATUS.find((s) => s.value === r.status)?.label ?? String(r.status)}</Badge> },
          { key: 'assigneeName', label: 'Ответственный' },
        ]}
        fields={[
          { name: 'title', label: 'Что нужно снять или подготовить', type: 'text', required: true },
          { name: 'location', label: 'Место', type: 'text', placeholder: 'Актовый зал' },
          { name: 'date', label: 'Дата', type: 'date' },
          { name: 'priority', label: 'Приоритет', type: 'select', options: PRIORITY, defaultValue: 'medium' },
          { name: 'description', label: 'Описание', type: 'textarea' },
        ]}
        transformPayload={(raw) => ({
          ...raw,
          date: raw.date || null,
          priority: raw.priority || 'medium',
        })}
        rowActions={canManage ? (row, reload) => <ManageMediaRequest row={row} reload={reload} /> : undefined}
      />
    </Stack>
  );
}

export default function MediaPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <MediaContent />
    </RoleGate>
  );
}
