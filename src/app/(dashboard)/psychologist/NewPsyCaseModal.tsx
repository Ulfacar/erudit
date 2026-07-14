'use client';

/**
 * Создание кейса психолога для любого из 4 субъектов (Этап 9):
 * ученик / родитель / учитель / группа(класс). Используется в кабинете психолога
 * и прямо из анкеты ученика (StudentPsyCard) с предзаданным субъектом.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Group, Modal, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { IconAlertTriangle } from '@tabler/icons-react';

export type SubjectType = 'student' | 'parent' | 'teacher' | 'group';

const RISK = {
  green: { label: 'Зелёный' }, yellow: { label: 'Жёлтый' }, red: { label: 'Красный' },
} as const;

const SUBJECT_CFG: Record<SubjectType, { endpoint: string; label: (r: any) => string; noun: string }> = { // eslint-disable-line @typescript-eslint/no-explicit-any
  student: { endpoint: '/api/v1/students', noun: 'ученика', label: (s) => `${s.lastName} ${s.firstName}${s.class ? ` (${s.class.grade}${s.class.letter})` : ''}` },
  parent: { endpoint: '/api/v1/parents', noun: 'родителя', label: (p) => `${p.lastName} ${p.firstName}` },
  teacher: { endpoint: '/api/v1/teachers', noun: 'учителя', label: (t) => `${t.lastName} ${t.firstName}` },
  group: { endpoint: '/api/v1/classes', noun: 'класс', label: (c) => `${c.grade}${c.letter}` },
};

interface ActiveCase { id: string; ownerName: string; isMine: boolean; riskLevel: keyof typeof RISK }

export function NewPsyCaseModal({
  opened, onClose, onCreated, subjectType, preset,
}: {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
  subjectType: SubjectType;
  /** фиксированный субъект (из анкеты) — скрывает выбор */
  preset?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const cfg = SUBJECT_CFG[subjectType];
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(preset?.id ?? null);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [risk, setRisk] = useState<keyof typeof RISK>('green');
  const [justification, setJustification] = useState('');
  const [active, setActive] = useState<ActiveCase[]>([]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  // сброс при каждом открытии
  useEffect(() => {
    if (!opened) return;
    setSubjectId(preset?.id ?? null); setTitle(''); setReason(''); setRisk('green');
    setJustification(''); setActive([]); setErr('');
  }, [opened, preset?.id]);

  // список субъектов (только когда выбор не зафиксирован)
  useEffect(() => {
    if (!opened || preset) return;
    fetch(cfg.endpoint).then((r) => r.json()).then((j) => {
      const data = (j.data ?? []) as Record<string, unknown>[];
      setOptions(data.map((r) => ({ value: String(r.id), label: cfg.label(r) })));
    }).catch(() => setOptions([]));
  }, [opened, preset, cfg]);

  // проверка активных кейсов у коллег — только для ученика
  useEffect(() => {
    if (subjectType !== 'student' || !subjectId) { setActive([]); return; }
    fetch(`/api/v1/psy/cases/active?studentId=${subjectId}`)
      .then((r) => r.json()).then((j) => setActive(j.data ?? [])).catch(() => setActive([]));
  }, [subjectType, subjectId]);

  const subjectName = useMemo(
    () => preset?.name ?? options.find((o) => o.value === subjectId)?.label ?? '',
    [preset, options, subjectId],
  );
  const foreignActive = active.filter((a) => !a.isMine);

  async function create() {
    setErr('');
    if (!subjectId || !title.trim()) { setErr(`Выберите ${cfg.noun} и укажите название`); return; }
    if (risk === 'red' && !justification.trim()) { setErr('Для красного риска нужно обоснование'); return; }
    setSaving(true);
    const payload: Record<string, unknown> = {
      subjectType, title, reason, riskLevel: risk, riskJustification: justification,
    };
    if (subjectType === 'student') payload.studentId = subjectId;
    else { payload.subjectId = subjectId; payload.subjectName = subjectName; }
    const res = await fetch('/api/v1/psy/cases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const j = await res.json();
    setSaving(false);
    if (!j.success) {
      const message = j.error?.message ?? 'Ошибка';
      if (res.status === 409 && j.error?.code === 'CONFLICT') {
        notifications.show({ color: 'orange', title: 'Кейс уже открыт', message });
        return;
      }
      setErr(message);
      return;
    }
    if (j.data?.existing) {
      notifications.show({ color: 'blue', message: 'У ученика уже есть активный кейс — открыт он.' });
    }
    onCreated();
    if (j.data?.id) router.push(`/psychologist/cases/${j.data.id}`);
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Открыть кейс" centered size="lg">
      <Stack gap="md">
        {preset ? (
          <Text size="sm"><Text span c="dimmed">{cfg.noun}: </Text><b>{preset.name}</b></Text>
        ) : (
          <Select
            label={`Субъект (${cfg.noun})`} placeholder="Найти" searchable required
            data={options} value={subjectId} onChange={setSubjectId}
          />
        )}
        {foreignActive.length > 0 && (
          <Alert color="orange" icon={<IconAlertTriangle size={16} />} title="Уже в работе">
            <Stack gap="xs">
              {foreignActive.map((a) => (
                <Group key={a.id} justify="space-between">
                  <Text size="sm">У коллеги <b>{a.ownerName}</b> (риск: {RISK[a.riskLevel].label})</Text>
                </Group>
              ))}
            </Stack>
          </Alert>
        )}
        <TextInput label="Название кейса" placeholder="Напр.: адаптация, тревожность" required value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <Textarea label="Причина обращения" autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        <Select
          label="Стартовый уровень риска" required
          data={Object.entries(RISK).map(([k, v]) => ({ value: k, label: v.label }))}
          value={risk} onChange={(v) => setRisk((v as keyof typeof RISK) ?? 'green')}
        />
        {risk === 'red' && (
          <Textarea
            label="Обоснование критического риска" required autosize minRows={2}
            description="Обязательно. Сгенерирует слепое safeguarding-уведомление координатору."
            value={justification} onChange={(e) => setJustification(e.currentTarget.value)}
          />
        )}
        {err && <Text c="red" size="sm">{err}</Text>}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={create} loading={saving}>Открыть кейс</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
