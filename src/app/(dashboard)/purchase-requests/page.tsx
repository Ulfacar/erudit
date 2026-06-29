'use client';

import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Modal, Select, Stack, Textarea, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconShoppingCart, IconX, IconAdjustments } from '@tabler/icons-react';
import type { Role } from '@prisma/client';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage, type ResourceRow } from '@/shared/components/ui/ResourcePage';
import { fmtDate, fmtMoney } from '@/shared/components/ui/resource-helpers';
import { useRole } from '@/shared/hooks/useRole';
import { roleMatches } from '@/shared/lib/role-access';

const PAGE_ROLES: Role[] = ['super_admin', 'analyst', 'finance_manager', 'accountant', 'chief_accountant', 'zavhoz', 'zavuch'];
const CREATE_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch', 'zavhoz'];
const DECISION_ROLES: Role[] = ['super_admin', 'finance_manager'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  approved: 'Одобрено',
  rejected: 'Отклонено',
  partial: 'Частично',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  partial: 'blue',
};

interface DecisionState {
  row: ResourceRow;
  status: 'approved' | 'rejected' | 'partial';
}

export default function PurchaseRequestsPage() {
  const { role } = useRole();
  const [decision, setDecision] = useState<DecisionState | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState<(() => void) | null>(null);
  const canCreate = roleMatches(CREATE_ROLES, role);
  const canDecide = roleMatches(DECISION_ROLES, role);

  function openDecision(row: ResourceRow, status: DecisionState['status'], reloadRows: () => void) {
    setDecision({ row, status });
    setDecisionNote(String(row.decisionNote ?? ''));
    setReload(() => reloadRows);
  }

  async function submitDecision() {
    if (!decision) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/purchase-requests/${decision.row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: decision.status,
          decisionNote: decisionNote.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка');
      notifications.show({ color: 'green', title: 'Заявка обновлена', message: STATUS_LABELS[decision.status] });
      setDecision(null);
      setDecisionNote('');
      reload?.();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось обновить заявку',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <RoleGate roles={PAGE_ROLES}>
      <Stack gap="md">
        <ResourcePage
          title="Заявки на закупку"
          icon={<IconShoppingCart size={22} color="#228be6" />}
          endpoint="/api/v1/purchase-requests"
          createLabel="Новая заявка"
          canCreate={canCreate}
          searchable
          rowActions={(row, reloadRows) => (
            <RoleGate roles={DECISION_ROLES} silent>
              {canDecide && row.status === 'pending' && (
                <Group gap={4} wrap="nowrap">
                  <Tooltip label="Одобрить">
                    <ActionIcon variant="subtle" color="green" onClick={() => openDecision(row, 'approved', reloadRows)}>
                      <IconCheck size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Частично">
                    <ActionIcon variant="subtle" color="blue" onClick={() => openDecision(row, 'partial', reloadRows)}>
                      <IconAdjustments size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Отклонить">
                    <ActionIcon variant="subtle" color="red" onClick={() => openDecision(row, 'rejected', reloadRows)}>
                      <IconX size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              )}
            </RoleGate>
          )}
          columns={[
            { key: 'title', label: 'Заявка' },
            { key: 'items', label: 'Что купить', render: (r) => String(r.items ?? '—') },
            { key: 'amount', label: 'Сумма', render: (r) => (r.amount == null ? '—' : fmtMoney(r.amount)) },
            {
              key: 'status',
              label: 'Статус',
              render: (r) => (
                <Badge variant="light" color={STATUS_COLORS[String(r.status)] ?? 'gray'} radius="sm">
                  {STATUS_LABELS[String(r.status)] ?? String(r.status)}
                </Badge>
              ),
            },
            { key: 'authorName', label: 'Автор', render: (r) => String(r.authorName ?? '—') },
            { key: 'createdAt', label: 'Дата', render: (r) => (r.createdAt ? fmtDate(r.createdAt) : '—') },
            { key: 'decisionNote', label: 'Комментарий', render: (r) => String(r.decisionNote ?? '—') },
          ]}
          fields={[
            { name: 'title', label: 'Заголовок', type: 'text', required: true },
            { name: 'items', label: 'Позиции', type: 'textarea', placeholder: 'Что нужно закупить' },
            { name: 'amount', label: 'Сумма (сом)', type: 'number' },
          ]}
        />

        <Modal
          opened={Boolean(decision)}
          onClose={() => setDecision(null)}
          title={decision ? STATUS_LABELS[decision.status] : 'Решение'}
          radius="lg"
        >
          <Stack gap="sm">
            <Select
              label="Решение"
              data={[
                { value: 'approved', label: 'Одобрено' },
                { value: 'partial', label: 'Частично' },
                { value: 'rejected', label: 'Отклонено' },
              ]}
              value={decision?.status ?? null}
              onChange={(value) => {
                if (!decision || !value) return;
                setDecision({ ...decision, status: value as DecisionState['status'] });
              }}
            />
            <Textarea
              label="Комментарий"
              minRows={3}
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDecision(null)}>Отмена</Button>
              <Button loading={saving} onClick={submitDecision}>Сохранить</Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </RoleGate>
  );
}
