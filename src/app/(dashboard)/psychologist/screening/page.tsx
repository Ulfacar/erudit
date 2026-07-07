'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Progress,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconClipboardHeart, IconPlus } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

type GradeBand = '1-4' | '5-9' | '10-11';
type CampaignStatus = 'active' | 'closed';

interface ScreeningCampaign {
  id: string;
  title: string;
  gradeBand: GradeBand | string;
  grade?: number | null;
  status: CampaignStatus | string;
  riskThreshold?: number | null;
  target: number;
  done: number;
  riskCount: number;
  coveragePct: number;
}

interface PsyTemplate {
  id: string;
  name: string;
  gradeBand?: string | null;
  direction?: string | null;
  isActive?: boolean;
}

interface ScreeningResult {
  id: string;
  isRisk: boolean;
  student: {
    psyCode: string;
    firstName: string;
    lastName: string;
    className: string;
  };
}

interface CampaignDetails extends ScreeningCampaign {
  results: ScreeningResult[];
}

const GRADE_BANDS = [
  { value: '1-4', label: '1-4 классы' },
  { value: '5-9', label: '5-9 классы' },
  { value: '10-11', label: '10-11 классы' },
];

const STATUS: Record<string, { label: string; color: string }> = {
  active: { label: 'Активна', color: 'green' },
  closed: { label: 'Закрыта', color: 'gray' },
};

function gradeBandLabel(value: string) {
  return GRADE_BANDS.find((item) => item.value === value)?.label ?? value;
}

function normalizeList<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data)) {
    return (json as { data: T[] }).data;
  }
  return [];
}

function MassScreening() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<ScreeningCampaign[]>([]);
  const [templates, setTemplates] = useState<PsyTemplate[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const [details, setDetails] = useState<CampaignDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [riskErr, setRiskErr] = useState('');

  const [title, setTitle] = useState('');
  const [gradeBand, setGradeBand] = useState<GradeBand | null>('5-9');
  const [grade, setGrade] = useState<number | ''>('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [riskThreshold, setRiskThreshold] = useState<number | ''>('');

  async function load() {
    setLoading(true);
    const [campaignsJson, templatesJson] = await Promise.all([
      fetch('/api/v1/psy/screening/campaigns').then((r) => r.json()).catch(() => []),
      fetch('/api/v1/psy/templates').then((r) => r.json()).catch(() => ({ data: [] })),
    ]);
    setCampaigns(normalizeList<ScreeningCampaign>(campaignsJson));
    setTemplates(normalizeList<PsyTemplate>(templatesJson).filter((template) => template.isActive));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const templateOptions = useMemo(
    () => templates
      .filter((template) => !template.gradeBand || template.gradeBand === gradeBand)
      .map((template) => ({ value: template.id, label: template.name })),
    [templates, gradeBand],
  );

  useEffect(() => {
    if (templateId && !templateOptions.some((item) => item.value === templateId)) {
      setTemplateId(null);
    }
  }, [templateId, templateOptions]);

  function resetForm() {
    setTitle('');
    setGradeBand('5-9');
    setGrade('');
    setTemplateId(null);
    setRiskThreshold('');
    setErr('');
  }

  async function createCampaign() {
    setErr('');
    if (!title.trim() || !gradeBand || !templateId) {
      setErr('Укажите название, ступень и методику');
      return;
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      title: title.trim(),
      gradeBand,
      templateId,
    };
    if (grade !== '') payload.grade = grade;
    if (riskThreshold !== '') payload.riskThreshold = riskThreshold;

    const res = await fetch('/api/v1/psy/screening/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok || json.success === false) {
      setErr(json.error?.message ?? 'Не удалось создать кампанию');
      return;
    }

    setNewOpen(false);
    resetForm();
    await load();
  }

  async function openRiskGroup(campaignId: string) {
    setRiskOpen(true);
    setDetails(null);
    setRiskErr('');
    setDetailsLoading(true);
    const res = await fetch(`/api/v1/psy/screening/campaigns/${campaignId}`);
    const json = await res.json().catch(() => ({}));
    setDetailsLoading(false);

    if (!res.ok || json.success === false) {
      setRiskErr(json.error?.message ?? 'Не удалось загрузить риск-группу');
      return;
    }

    setDetails((json.data ?? json) as CampaignDetails);
  }

  async function closeCampaign(campaignId: string) {
    setClosingId(campaignId);
    await fetch(`/api/v1/psy/screening/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });
    setClosingId(null);
    await load();
  }

  const riskResults = details?.results.filter((result) => result.isRisk) ?? [];

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconClipboardHeart size={26} color="#9c36b5" />
          <Title order={2}>Массовый скрининг</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setNewOpen(true)}>
          Новая кампания
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md">
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : campaigns.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">Пока нет кампаний скрининга.</Text>
        ) : (
          <Stack gap="md">
            {campaigns.map((campaign) => {
              const status = STATUS[campaign.status] ?? STATUS.closed;
              const coverage = Math.max(0, Math.min(100, campaign.coveragePct ?? 0));
              const isActive = campaign.status === 'active';

              return (
                <Card key={campaign.id} withBorder radius="sm" padding="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text fw={600}>{campaign.title}</Text>
                        <Text size="sm" c="dimmed">
                          {gradeBandLabel(campaign.gradeBand)} · {campaign.grade ?? 'вся ступень'}
                        </Text>
                      </div>
                      <Group gap="xs">
                        <Badge color={status.color} variant="light">{status.label}</Badge>
                        <Badge color="red" variant="light">группа риска: {campaign.riskCount}</Badge>
                      </Group>
                    </Group>

                    <div>
                      <Progress value={coverage} color="violet" size="md" radius="xl" />
                      <Text size="sm" c="dimmed" mt={4}>
                        {campaign.done}/{campaign.target} · охват {campaign.coveragePct}%
                      </Text>
                    </div>

                    {isActive && (
                      <Group justify="flex-end" gap="xs">
                        <Button variant="light" size="xs" onClick={() => openRiskGroup(campaign.id)}>
                          Риск-группа
                        </Button>
                        <Button
                          variant="outline"
                          color="gray"
                          size="xs"
                          loading={closingId === campaign.id}
                          onClick={() => closeCampaign(campaign.id)}
                        >
                          Закрыть
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </Paper>

      <Modal opened={newOpen} onClose={() => { setNewOpen(false); resetForm(); }} title="Новая кампания" centered size="lg">
        <Stack gap="md">
          <TextInput
            label="Название"
            required
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
          <Select
            label="Ступень"
            required
            data={GRADE_BANDS}
            value={gradeBand}
            onChange={(value) => setGradeBand(value as GradeBand | null)}
          />
          <NumberInput
            label="Параллель"
            placeholder="вся ступень"
            min={1}
            max={11}
            value={grade}
            onChange={(value) => setGrade(typeof value === 'number' ? value : '')}
          />
          <Select
            label="Методика"
            placeholder="Выберите методику"
            searchable
            required
            data={templateOptions}
            value={templateId}
            onChange={setTemplateId}
          />
          <NumberInput
            label="Порог риска"
            value={riskThreshold}
            onChange={(value) => setRiskThreshold(typeof value === 'number' ? value : '')}
          />
          {err && <Text c="red" size="sm">{err}</Text>}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => { setNewOpen(false); resetForm(); }}>
              Отмена
            </Button>
            <Button onClick={createCampaign} loading={saving}>Создать</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={riskOpen} onClose={() => setRiskOpen(false)} title="Риск-группа" centered size="lg">
        {detailsLoading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : riskErr ? (
          <Text c="red" size="sm">{riskErr}</Text>
        ) : riskResults.length === 0 ? (
          <Text c="dimmed">Пока нет учеников в группе риска</Text>
        ) : (
          <Stack gap="xs">
            {riskResults.map((result) => (
              <Card key={result.id} withBorder radius="sm" padding="sm">
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text fw={600}>{result.student.psyCode}</Text>
                    <Text size="sm">{result.student.lastName} {result.student.firstName}</Text>
                  </div>
                  <Badge variant="light" color="gray">{result.student.className}</Badge>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

export default function ScreeningPage() {
  return (
    <RoleGate roles={['psychologist', 'senior_psychologist', 'psy_coordinator', 'super_admin']}>
      <MassScreening />
    </RoleGate>
  );
}
