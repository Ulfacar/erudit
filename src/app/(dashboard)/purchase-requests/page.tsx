'use client';

import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Modal, Select, Stack, Textarea, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconShoppingCart, IconX, IconAdjustments, IconSend } from '@tabler/icons-react';
import type { Role } from '@prisma/client';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage, type ResourceRow } from '@/shared/components/ui/ResourcePage';
import { SignatureBadge } from '@/shared/components/ui/SignatureBadge';
import { fmtDate, fmtMoney } from '@/shared/components/ui/resource-helpers';
import { useRole } from '@/shared/hooks/useRole';
import { roleMatches } from '@/shared/lib/role-access';

const PAGE_ROLES: Role[] = ['super_admin', 'analyst', 'finance_manager', 'accountant', 'chief_accountant', 'zavhoz', 'zavuch'];
const CREATE_ROLES: Role[] = ['super_admin', 'analyst', 'zavuch', 'zavhoz'];
const FORWARD_ROLES: Role[] = ['super_admin', 'accountant', 'chief_accountant'];
const DECISION_ROLES: Role[] = ['super_admin', 'finance_manager'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  forwarded: 'У финменеджера',
  approved: 'Одобрено',
  rejected: 'Отклонено',
  partial: 'Частично',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  forwarded: 'orange',
  approved: 'green',
  rejected: 'red',
  partial: 'blue',
};

const APPROVE_REQUEST_LABEL = 'Утвердить заявку';
const PARTIAL_REQUEST_LABEL = 'Частично утвердить заявку';
const REJECT_REQUEST_LABEL = 'Отклонить заявку';
const FORWARD_REQUEST_LABEL = 'Передать финменеджеру';

interface DecisionState {
  row: ResourceRow;
  status: 'approved' | 'rejected' | 'partial';
}

export default function PurchaseRequestsPage() {
  const { role } = useRole();
  const [decision, setDecision] = useState<DecisionState | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [forwardingId, setForwardingId] = useState<string | null>(null);
  const [reload, setReload] = useState<(() => void) | null>(null);
  const canCreate = roleMatches(CREATE_ROLES, role);
  const canForward = roleMatches(FORWARD_ROLES, role);
  const canDecide = roleMatches(DECISION_ROLES, role);

  function openDecision(row: ResourceRow, status: DecisionState['status'], reloadRows: () => void) {
    setDecision({ row, status });
    setDecisionNote(String(row.decisionNote ?? ''));
    setReload(() => reloadRows);
  }

  async function forwardRequest(row: ResourceRow, reloadRows: () => void) {
    setForwardingId(String(row.id));
    try {
      const res = await fetch(`/api/v1/purchase-requests/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forward' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Ошибка');
      notifications.show({ color: 'green', title: 'Передано финменеджеру', message: String(row.title ?? '') });
      reloadRows();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось передать заявку финменеджеру',
      });
    } finally {
      setForwardingId(null);
    }
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
            <Group gap={4} wrap="nowrap">
              <RoleGate roles={FORWARD_ROLES} silent>
                {canForward && row.status === 'pending' && (
                  <Tooltip label={FORWARD_REQUEST_LABEL}>
                    <ActionIcon
                      variant="subtle"
                      color="orange"
                      aria-label={FORWARD_REQUEST_LABEL}
                      title={FORWARD_REQUEST_LABEL}
                      disabled={forwardingId === row.id}
                      onClick={() => forwardRequest(row, reloadRows)}
                    >
                      <IconSend size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </RoleGate>
              <RoleGate roles={DECISION_ROLES} silent>
                {canDecide && row.status === 'forwarded' && (
                  <>
                    <Tooltip label="Одобрить">
                      <ActionIcon
                        variant="subtle"
                        color="green"
                        aria-label={APPROVE_REQUEST_LABEL}
                        title={APPROVE_REQUEST_LABEL}
                        onClick={() => openDecision(row, 'approved', reloadRows)}
                      >
                        <IconCheck size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Частично">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        aria-label={PARTIAL_REQUEST_LABEL}
                        title={PARTIAL_REQUEST_LABEL}
                        onClick={() => openDecision(row, 'partial', reloadRows)}
                      >
                        <IconAdjustments size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Отклонить">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={REJECT_REQUEST_LABEL}
                        title={REJECT_REQUEST_LABEL}
                        onClick={() => openDecision(row, 'rejected', reloadRows)}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </>
                )}
              </RoleGate>
            </Group>
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
            {
              key: 'forwardedByName',
              label: 'Передал',
              render: (r) => (
                <SignatureBadge
                  label="Передал"
                  name={typeof r.forwardedByName === 'string' ? r.forwardedByName : null}
                  role={typeof r.forwardedRole === 'string' ? r.forwardedRole : null}
                  date={typeof r.forwardedAt === 'string' || r.forwardedAt instanceof Date ? r.forwardedAt : null}
                />
              ),
            },
            {
              key: 'reviewedByName',
              label: 'Подписал',
              render: (r) => (
                <SignatureBadge
                  label="Подписал (решение)"
                  name={typeof r.reviewedByName === 'string' ? r.reviewedByName : null}
                  role={typeof r.reviewedRole === 'string' ? r.reviewedRole : null}
                  date={typeof r.reviewedAt === 'string' || r.reviewedAt instanceof Date ? r.reviewedAt : null}
                />
              ),
            },
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
