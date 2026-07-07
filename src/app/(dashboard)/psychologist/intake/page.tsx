'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { IconClipboardHeart } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

type Verdict = 'recommended' | 'not_recommended' | 'redirected';
type RiskLevel = 'green' | 'yellow' | 'red';

interface IntakeCandidate {
  id: string;
  childName: string;
  targetGrade: number | string;
  phone: string;
  stage: string;
  psychCaseId?: string | null;
  verdict?: Verdict | null;
  done: boolean;
}

const VERDICT_META: Record<Verdict, { label: string; color: string }> = {
  recommended: { label: 'Рекомендован', color: 'green' },
  not_recommended: { label: 'Не рекомендован', color: 'red' },
  redirected: { label: 'Перенаправлен', color: 'orange' },
};

const VERDICT_OPTIONS = Object.entries(VERDICT_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

const RISK_OPTIONS: { value: RiskLevel; label: string }[] = [
  { value: 'green', label: 'Зелёный' },
  { value: 'yellow', label: 'Жёлтый' },
  { value: 'red', label: 'Красный' },
];

function Intake() {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<IntakeCandidate[]>([]);
  const [selected, setSelected] = useState<IntakeCandidate | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [note, setNote] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('green');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    setErr('');
    const json = await fetch('/api/v1/psy/intake')
      .then((response) => response.json())
      .catch(() => ({ data: [] }));
    setCandidates(Array.isArray(json.data) ? json.data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openTest(candidate: IntakeCandidate) {
    setSelected(candidate);
    setVerdict(candidate.verdict ?? null);
    setNote('');
    setRiskLevel('green');
    setErr('');
  }

  function closeTest() {
    setSelected(null);
    setVerdict(null);
    setNote('');
    setRiskLevel('green');
    setErr('');
  }

  async function save() {
    setErr('');
    if (!selected || !verdict) {
      setErr('Укажите заключение');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/v1/psy/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admissionLeadId: selected.id,
        verdict,
        note,
        riskLevel,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok || json.success === false) {
      setErr(json.error?.message ?? 'Не удалось сохранить экспресс-тест');
      return;
    }

    closeTest();
    await load();
  }

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs">
        <IconClipboardHeart size={26} color="#9c36b5" />
        <Title order={2}>Приём — экспресс-тест поступающих</Title>
      </Group>

      <Paper withBorder p="md" radius="md">
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : candidates.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">Нет поступающих на экспресс-тест</Text>
        ) : (
          <Stack gap="md">
            {candidates.map((candidate) => {
              const verdictMeta = candidate.verdict ? VERDICT_META[candidate.verdict] : null;

              return (
                <Card key={candidate.id} withBorder radius="sm" padding="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text fw={600}>{candidate.childName}</Text>
                      <Text size="sm" c="dimmed">
                        класс поступления: {candidate.targetGrade}
                      </Text>
                      <Text size="sm" c="dimmed">{candidate.phone}</Text>
                    </div>
                    <Group gap="xs">
                      {candidate.done && verdictMeta && (
                        <Badge color={verdictMeta.color} variant="light">
                          {verdictMeta.label}
                        </Badge>
                      )}
                      <Button size="xs" variant="light" onClick={() => openTest(candidate)}>
                        {candidate.done ? 'Изменить' : 'Провести'}
                      </Button>
                    </Group>
                  </Group>
                </Card>
              );
            })}
          </Stack>
        )}
      </Paper>

      <Modal
        opened={!!selected}
        onClose={closeTest}
        title={selected ? `Экспресс-тест — ${selected.childName}` : 'Экспресс-тест'}
        centered
        size="lg"
      >
        <Stack gap="md">
          <Select
            label="Заключение"
            placeholder="Выберите заключение"
            required
            data={VERDICT_OPTIONS}
            value={verdict}
            onChange={(value) => setVerdict(value as Verdict | null)}
          />
          <Textarea
            label="Заметка психолога"
            autosize
            minRows={3}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
          <Select
            label="Уровень риска"
            data={RISK_OPTIONS}
            value={riskLevel}
            onChange={(value) => setRiskLevel((value as RiskLevel | null) ?? 'green')}
          />
          {err && <Text c="red" size="sm">{err}</Text>}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={closeTest}>
              Отмена
            </Button>
            <Button onClick={save} loading={saving}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function IntakePage() {
  return (
    <RoleGate roles={['psychologist', 'senior_psychologist', 'specialist', 'super_admin']}>
      <Intake />
    </RoleGate>
  );
}
