'use client';

import { useMemo, useState, type DragEvent } from 'react';
import { ActionIcon, Badge, Button, Group, Loader, Modal, Paper, SegmentedControl, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconEdit, IconPlayerPlay, IconVideo } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
const BOARD_COLUMNS = ['open', 'in_progress', 'done'] as const;
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

type BoardStatus = typeof BOARD_COLUMNS[number];

type MediaRequest = {
  id: string; title: string; description?: string | null;
  location?: string | null; date?: string | null;
  priority: 'high' | 'medium' | 'low';
  source: 'event' | 'manual'; eventId?: string | null;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  assigneeName?: string | null; requesterId?: string | null; createdAt: string;
};

function sortCards(a: MediaRequest, b: MediaRequest): number {
  const p = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
  if (p !== 0) return p;
  if (a.date && b.date) return a.date.localeCompare(b.date);
  if (a.date) return -1;
  if (b.date) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

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

function MediaKanban({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<BoardStatus | null>(null);

  const { data: items = [], isLoading } = useQuery<MediaRequest[]>({
    queryKey: ['media-requests', 'board'],
    queryFn: async () => {
      const res = await fetch('/api/v1/media-requests');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      return (json.data || []) as MediaRequest[];
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BoardStatus }) => {
      const res = await fetch(`/api/v1/media-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось обновить заявку');
      return json;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['media-requests', 'board'] });
      const prev = queryClient.getQueryData<MediaRequest[]>(['media-requests', 'board']);
      queryClient.setQueryData<MediaRequest[]>(
        ['media-requests', 'board'],
        (old) => (old ?? []).map((r) => (r.id === id ? { ...r, status } : r))
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['media-requests', 'board'], ctx.prev);
      notifications.show({ color: 'red', title: 'Ошибка', message: err instanceof Error ? err.message : 'Не удалось обновить заявку' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['media-requests', 'board'] }),
  });

  const grouped = useMemo(
    () => BOARD_COLUMNS.map((status) => ({
      status,
      items: items.filter((item) => item.status === status).sort(sortCards),
    })),
    [items]
  );

  function onDragEnd() {
    setDraggedId(null);
    setOverCol(null);
  }

  function onDropCard(id: string, to: BoardStatus) {
    const item = items.find((request) => request.id === id);
    if (!item || item.status === to) return;
    mutation.mutate({ id, status: to });
  }

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Group align="flex-start" grow wrap="nowrap" style={{ overflowX: 'auto' }}>
      {grouped.map((column) => (
        <KanbanColumn
          key={column.status}
          status={column.status}
          items={column.items}
          canManage={canManage}
          draggedId={draggedId}
          isOver={overCol === column.status}
          onDropCard={onDropCard}
          onDragStart={setDraggedId}
          onDragEnd={onDragEnd}
          onDragOverCol={setOverCol}
        />
      ))}
    </Group>
  );
}

function KanbanColumn({
  status,
  items,
  canManage,
  draggedId,
  isOver,
  onDropCard,
  onDragStart,
  onDragEnd,
  onDragOverCol,
}: {
  status: BoardStatus;
  items: MediaRequest[];
  canManage: boolean;
  draggedId: string | null;
  isOver: boolean;
  onDropCard: (id: string, status: BoardStatus) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOverCol: (status: BoardStatus) => void;
}) {
  const dropHandlers = canManage
    ? {
        onDragOver: (e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        },
        onDragEnter: () => onDragOverCol(status),
        onDrop: (e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          const id = e.dataTransfer.getData('text/plain') || draggedId;
          if (id) onDropCard(id, status);
          onDragEnd();
        },
      }
    : {};

  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      style={{ minWidth: 260, flex: 1, background: isOver ? 'var(--mantine-color-blue-0)' : undefined }}
      {...dropHandlers}
    >
      <Group justify="space-between" mb="sm">
        <Text fw={600} size="sm">{STATUS.find((s) => s.value === status)?.label ?? status}</Text>
        <Badge variant="light" color={ST_COLOR[status]} radius="sm">{items.length}</Badge>
      </Group>

      {items.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">Нет заявок</Text>
      ) : (
        <Stack gap="xs">
          {items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              canManage={canManage}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function KanbanCard({
  item,
  canManage,
  onDragStart,
  onDragEnd,
}: {
  item: MediaRequest;
  canManage: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <Paper
      withBorder
      p="xs"
      radius="md"
      style={{ borderLeft: `3px solid var(--mantine-color-${PR_COLOR[item.priority]}-6)`, cursor: canManage ? 'grab' : 'default' }}
      draggable={canManage}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(item.id);
      }}
      onDragEnd={onDragEnd}
    >
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500} lineClamp={2}>{item.title}</Text>
          <Badge variant="light" color={PR_COLOR[item.priority]} radius="sm">
            {PRIORITY.find((p) => p.value === item.priority)?.label ?? item.priority}
          </Badge>
        </Group>
        {item.source === 'event' && (
          <Badge variant="light" color="pink" radius="sm">мероприятие</Badge>
        )}
        {item.location && <Text size="xs" c="dimmed">{item.location}</Text>}
        {item.date && <Text size="xs" c="dimmed">{fmtDate(String(item.date))}</Text>}
        {item.assigneeName && <Text size="xs" c="dimmed">{item.assigneeName}</Text>}
      </Stack>
    </Paper>
  );
}

function MediaContent() {
  const { has } = useRole();
  const canManage = has(...MANAGE_ROLES);
  const [tab, setTab] = useState('all');
  const [view, setView] = useState<'table' | 'board'>('table');
  const query = tab === 'all' ? undefined : { status: tab };

  return (
    <Stack gap="md">
      <SegmentedControl
        data={[
          { value: 'table', label: 'Таблица' },
          { value: 'board', label: 'Канбан' },
        ]}
        value={view}
        onChange={(value) => setView(value as 'table' | 'board')}
        size="xs"
        color="bilimosBlue"
        w="fit-content"
      />
      <TelegramQrPrint mode="film" label="QR для съемки" />
      {view === 'table' ? (
        <>
          <Group gap="xs">
            {STATUS_TABS.map((item) => (
              <Button
                key={item.value}
                size="xs"
                variant={tab === item.value ? 'filled' : 'light'}
                color={tab === item.value ? 'bilimosBlue' : 'gray'}
                onClick={() => setTab(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </Group>
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
        </>
      ) : (
        <MediaKanban canManage={canManage} />
      )}
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
