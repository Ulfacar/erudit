'use client';

import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Modal, Select, Stack, Text, Textarea, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAdjustments, IconListDetails } from '@tabler/icons-react';
import type { Role } from '@prisma/client';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage, type ResourceRow } from '@/shared/components/ui/ResourcePage';
import { fmtDate, fmtMoney } from '@/shared/components/ui/resource-helpers';
import { useRole } from '@/shared/hooks/useRole';
import { roleMatches } from '@/shared/lib/role-access';
import { PRESETS, SCHOOL_SIZES, getModuleById } from '@/shared/lib/tariff-config';

const PAGE_ROLES: Role[] = ['super_admin', 'founder', 'analyst'];

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  won: 'Закрыта (успех)',
  lost: 'Закрыта (отказ)',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bilimosBlue',
  in_progress: 'orange',
  won: 'green',
  lost: 'red',
};

const SIZE_LABELS = Object.fromEntries(SCHOOL_SIZES.map((size) => [size.id, size.label]));
const PRESET_LABELS = Object.fromEntries(PRESETS.map((preset) => [preset.id, preset.label]));

type LeadStatus = 'new' | 'in_progress' | 'won' | 'lost';

interface DecisionState {
  row: ResourceRow;
  status: LeadStatus;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function selectedModuleLabels(row: ResourceRow) {
  return asStringArray(row.selectedModules)
    .map((id) => getModuleById(id)?.label ?? id)
    .filter(Boolean);
}

function tariffSummary(row: ResourceRow) {
  if (row.pricingMode === 'custom') {
    const modules = selectedModuleLabels(row);
    const title = modules.length ? modules.join('\n') : 'Модули не выбраны';

    return (
      <Tooltip label={<Text style={{ whiteSpace: 'pre-line' }}>{title}</Text>} multiline>
        <Badge variant="light" color="bilimosBlue" radius="sm" title={title}>
          Свой набор
        </Badge>
      </Tooltip>
    );
  }

  if (row.presetId) {
    return String(PRESET_LABELS[String(row.presetId)] ?? row.presetId);
  }

  return '—';
}

function annualLicenceSummary(row: ResourceRow) {
  if (row.annualLicence !== null && row.annualLicence !== undefined) return fmtMoney(row.annualLicence);
  if (row.licenseTotal !== null && row.licenseTotal !== undefined) return `${fmtMoney(row.licenseTotal)} (стар.)`;
  return '—';
}

export default function TariffLeadsPage() {
  const { role } = useRole();
  const [decision, setDecision] = useState<DecisionState | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState<(() => void) | null>(null);
  const canDelete = roleMatches(['super_admin'], role);

  function openDecision(row: ResourceRow, reloadRows: () => void) {
    setDecision({ row, status: String(row.status ?? 'new') as LeadStatus });
    setDecisionNote(String(row.decisionNote ?? ''));
    setReload(() => reloadRows);
  }

  async function submitDecision() {
    if (!decision) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/tariff-leads/${decision.row.id}`, {
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
          title="Заявки на тариф"
          icon={<IconListDetails size={22} color="#228be6" />}
          endpoint="/api/v1/tariff-leads"
          canCreate={false}
          canDelete={canDelete}
          searchable
          emptyText="Пока нет заявок"
          rowActions={(row, reloadRows) => (
            <Tooltip label="Сменить статус">
              <ActionIcon
                variant="subtle"
                color="blue"
                aria-label="Сменить статус"
                title="Сменить статус"
                onClick={() => openDecision(row, reloadRows)}
              >
                <IconAdjustments size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          columns={[
            { key: 'contactName', label: 'Контакт' },
            { key: 'contactPhone', label: 'Телефон' },
            { key: 'contactSchool', label: 'Школа', render: (r) => String(r.contactSchool ?? '—') },
            {
              key: 'schoolSize',
              label: 'Размер',
              render: (r) => String(SIZE_LABELS[String(r.schoolSize)] ?? '—'),
            },
            {
              key: 'presetId',
              label: 'Тариф',
              render: tariffSummary,
            },
            {
              key: 'annualLicence',
              label: 'Лицензия/год',
              render: (r) => (
                <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {annualLicenceSummary(r)}
                </Text>
              ),
            },
            {
              key: 'yearOne',
              label: 'Год 1',
              render: (r) => (
                <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(r.yearOne)}
                </Text>
              ),
            },
            {
              key: 'aiInterest',
              label: 'AI',
              render: (r) =>
                r.aiInterest ? (
                  <Badge variant="light" color="violet" radius="sm">
                    Да
                  </Badge>
                ) : (
                  '—'
                ),
            },
            {
              key: 'status',
              label: 'Статус',
              render: (r) => (
                <Badge variant="light" color={STATUS_COLORS[String(r.status)] ?? 'gray'} radius="xl">
                  {STATUS_LABELS[String(r.status)] ?? String(r.status)}
                </Badge>
              ),
            },
            { key: 'authorName', label: 'Автор', render: (r) => String(r.authorName ?? '—') },
            { key: 'createdAt', label: 'Дата', render: (r) => (r.createdAt ? fmtDate(r.createdAt) : '—') },
            {
              key: 'decisionNote',
              label: 'Комментарий',
              render: (r) => (
                <Text size="sm" c="dimmed" lineClamp={1}>
                  {String(r.decisionNote ?? '—')}
                </Text>
              ),
            },
          ]}
        />

        <Modal
          opened={Boolean(decision)}
          onClose={() => setDecision(null)}
          title="Смена статуса"
          radius="lg"
        >
          <Stack gap="sm">
            <Select
              label="Статус"
              data={[
                { value: 'new', label: 'Новая' },
                { value: 'in_progress', label: 'В работе' },
                { value: 'won', label: 'Закрыта (успех)' },
                { value: 'lost', label: 'Закрыта (отказ)' },
              ]}
              value={decision?.status ?? null}
              onChange={(value) => {
                if (!decision || !value) return;
                setDecision({ ...decision, status: value as LeadStatus });
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
