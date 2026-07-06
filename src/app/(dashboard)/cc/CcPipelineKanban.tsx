'use client';

import { useMemo, useState, type DragEvent } from 'react';
import { Badge, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CC_ADMISSION_STATUS_LABELS } from '@/modules/cc/labels';
import { useRole } from '@/shared/hooks/useRole';

const CC_ROLES = ['college_counselor', 'super_admin'] as const;
const COLUMNS = ['scouting', 'document_prep', 'submitted', 'decision_pending', 'offer_received', 'rejected', 'accepted_final'] as const;

type Status = typeof COLUMNS[number];

export type CcKanbanApplication = {
  id: string;
  universityName: string;
  country?: string | null;
  program?: string | null;
  admissionStatus: Status;
  deadlineDate?: string | null;
};

const STATUS_COLORS: Record<Status, string> = {
  scouting: 'gray',
  document_prep: 'blue',
  submitted: 'violet',
  decision_pending: 'yellow',
  offer_received: 'green',
  rejected: 'red',
  accepted_final: 'teal',
};

function daysLeft(date?: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function deadlineColor(days: number | null) {
  if (days == null) return 'gray';
  if (days <= 7) return 'red';
  if (days <= 30) return 'yellow';
  return 'blue';
}

function sortCards(a: CcKanbanApplication, b: CcKanbanApplication) {
  if (a.deadlineDate && b.deadlineDate) return a.deadlineDate.localeCompare(b.deadlineDate);
  if (a.deadlineDate) return -1;
  if (b.deadlineDate) return 1;
  return a.universityName.localeCompare(b.universityName);
}

export function CcPipelineKanban({
  applications,
  queryKey,
}: {
  applications: CcKanbanApplication[];
  queryKey: unknown[];
}) {
  const queryClient = useQueryClient();
  const { has } = useRole();
  const canManage = has(...CC_ROLES);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const res = await fetch(`/api/v1/cc/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admissionStatus: status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось обновить статус');
      return json.data;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          applications: (old.applications ?? []).map((app: CcKanbanApplication) =>
            app.id === id ? { ...app, admissionStatus: status } : app,
          ),
        };
      });
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: err instanceof Error ? err.message : 'Не удалось обновить статус',
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const grouped = useMemo(
    () => COLUMNS.map((status) => ({
      status,
      items: applications.filter((app) => app.admissionStatus === status).sort(sortCards),
    })),
    [applications],
  );

  if (mutation.isPending && applications.length === 0) {
    return <Loader size="sm" />;
  }

  function onDropCard(id: string, status: Status) {
    const item = applications.find((app) => app.id === id);
    if (!item || item.admissionStatus === status) return;
    mutation.mutate({ id, status });
  }

  function onDragEnd() {
    setDraggedId(null);
    setOverCol(null);
  }

  return (
    <Group align="stretch" wrap="nowrap" style={{ overflowX: 'auto', paddingBottom: 8 }}>
      {grouped.map((column) => (
        <Paper
          key={column.status}
          withBorder
          p="sm"
          radius="sm"
          style={{ minWidth: 260, flex: '0 0 260px', background: overCol === column.status ? 'var(--mantine-color-blue-0)' : undefined }}
          onDragOver={(e: DragEvent<HTMLDivElement>) => {
            if (!canManage) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDragEnter={() => canManage && setOverCol(column.status)}
          onDrop={(e: DragEvent<HTMLDivElement>) => {
            if (!canManage) return;
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain') || draggedId;
            if (id) onDropCard(id, column.status);
            onDragEnd();
          }}
        >
          <Group justify="space-between" mb="sm" wrap="nowrap">
            <Text size="sm" fw={600}>{CC_ADMISSION_STATUS_LABELS[column.status]}</Text>
            <Badge variant="light" color={STATUS_COLORS[column.status]} radius="sm">{column.items.length}</Badge>
          </Group>

          {column.items.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">Нет заявок</Text>
          ) : (
            <Stack gap="xs">
              {column.items.map((app) => {
                const days = daysLeft(app.deadlineDate);
                return (
                  <Paper
                    key={app.id}
                    withBorder
                    p="xs"
                    radius="sm"
                    draggable={canManage}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', app.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedId(app.id);
                    }}
                    onDragEnd={onDragEnd}
                    style={{ cursor: canManage ? 'grab' : 'default' }}
                  >
                    <Stack gap={4}>
                      <Text size="sm" fw={600} lineClamp={2}>{app.universityName}</Text>
                      {(app.country || app.program) && (
                        <Text size="xs" c="dimmed" lineClamp={2}>{[app.country, app.program].filter(Boolean).join(' · ')}</Text>
                      )}
                      {days != null && (
                        <Badge variant="light" color={deadlineColor(days)} radius="sm" w="fit-content">
                          {days >= 0 ? `${days} дн.` : 'просрочено'}
                        </Badge>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      ))}
    </Group>
  );
}
