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
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface ScreeningQuestion {
  text: string;
  type: string;
}

interface ScreeningSchema {
  metric?: string;
  scaleMin?: number;
  scaleMax?: number;
  questions?: ScreeningQuestion[];
}

interface ScreeningCampaign {
  id: string;
  title: string;
  gradeBand: string;
  grade?: number | null;
  done: boolean;
  template: {
    id: string;
    name: string;
    schema: unknown;
  };
}

function normalizeList<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data)) {
    return (json as { data: T[] }).data;
  }
  return [];
}

function toScreeningSchema(schema: unknown): ScreeningSchema {
  if (!schema || typeof schema !== 'object') return {};

  const value = schema as {
    metric?: unknown;
    scaleMin?: unknown;
    scaleMax?: unknown;
    questions?: unknown;
  };

  return {
    metric: typeof value.metric === 'string' ? value.metric : undefined,
    scaleMin: typeof value.scaleMin === 'number' ? value.scaleMin : undefined,
    scaleMax: typeof value.scaleMax === 'number' ? value.scaleMax : undefined,
    questions: Array.isArray(value.questions)
      ? value.questions
          .filter((item): item is { text?: unknown; type?: unknown } => item != null && typeof item === 'object')
          .map((item) => ({
            text: typeof item.text === 'string' ? item.text : '',
            type: typeof item.type === 'string' ? item.type : '',
          }))
      : undefined,
  };
}

function StudentScreening() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<ScreeningCampaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<ScreeningCampaign | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const json = await fetch('/api/v1/psy/screening/campaigns/mine')
      .then((res) => res.json())
      .catch(() => ({ data: [] }));
    setCampaigns(normalizeList<ScreeningCampaign>(json.data ?? json));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const activeSchema = useMemo(
    () => toScreeningSchema(activeCampaign?.template.schema),
    [activeCampaign],
  );
  const scaleQuestions = useMemo(
    () => (activeSchema.questions ?? []).filter((question) => (question.type ?? 'scale') === 'scale'),
    [activeSchema],
  );
  const scaleMin = activeSchema.scaleMin ?? 0;
  const scaleMax = activeSchema.scaleMax ?? 10;

  function openCampaign(campaign: ScreeningCampaign) {
    const schema = toScreeningSchema(campaign.template.schema);
    const questions = (schema.questions ?? []).filter((question) => (question.type ?? 'scale') === 'scale');
    setActiveCampaign(campaign);
    setAnswers(questions.map(() => 0));
    setError('');
    setMessage('');
  }

  function closeCampaign() {
    setActiveCampaign(null);
    setAnswers([]);
    setError('');
  }

  async function submit() {
    if (!activeCampaign || scaleQuestions.length === 0) return;

    setSubmitting(true);
    setError('');
    const score = answers.reduce((sum, value) => sum + (value || 0), 0);
    const res = await fetch(`/api/v1/psy/screening/campaigns/${activeCampaign.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawScores: { answers }, score }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok || json.success === false) {
      setError(json.error?.message ?? 'Не удалось сохранить ответ');
      return;
    }

    setCampaigns((items) => items.map((item) => (
      item.id === activeCampaign.id ? { ...item, done: true } : item
    )));
    setActiveCampaign(null);
    setAnswers([]);
    setMessage('Спасибо! Ваш ответ сохранён.');
  }

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>Скрининг</Title>
        <Text c="dimmed">Пройдите короткий опрос — это займёт пару минут</Text>
      </Stack>

      {message && <Text c="dimmed">{message}</Text>}

      {loading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : campaigns.length === 0 ? (
        <Text c="dimmed">Сейчас нет доступных опросов</Text>
      ) : (
        <Stack gap="md">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} withBorder radius="md" p="md">
              <Group justify="space-between" align="flex-start" gap="md">
                <Stack gap={4}>
                  <Title order={4}>{campaign.title}</Title>
                  <Text size="sm" c="dimmed">{campaign.template.name}</Text>
                </Stack>
                {campaign.done ? (
                  <Badge color="green" variant="light">Пройдено</Badge>
                ) : (
                  <Button onClick={() => openCampaign(campaign)}>Пройти</Button>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Modal
        opened={activeCampaign != null}
        onClose={closeCampaign}
        title={activeCampaign?.title ?? 'Опрос'}
        size="lg"
      >
        {scaleQuestions.length === 0 ? (
          <Text c="dimmed">Опрос недоступен</Text>
        ) : (
          <Stack gap="md">
            <Text size="sm" c="dimmed">{activeCampaign?.template.name}</Text>
            <Stack gap="sm">
              {scaleQuestions.map((question, index) => (
                <Group key={index} gap="sm" wrap="nowrap" align="flex-end">
                  <Text size="sm" style={{ flex: 1 }}>
                    {question.text || `Вопрос ${index + 1}`}
                  </Text>
                  <NumberInput
                    w={100}
                    min={scaleMin}
                    max={scaleMax}
                    value={answers[index] ?? 0}
                    onChange={(value) => setAnswers((current) => current.map((item, itemIndex) => (
                      itemIndex === index ? Number(value) || 0 : item
                    )))}
                  />
                </Group>
              ))}
            </Stack>
            {error && <Text c="red" size="sm">{error}</Text>}
            <Group justify="flex-end">
              <Button variant="light" onClick={closeCampaign}>Отмена</Button>
              <Button loading={submitting} onClick={submit}>Отправить</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

export default function ScreeningPage() {
  return (
    <RoleGate roles={['student']}>
      <StudentScreening />
    </RoleGate>
  );
}
