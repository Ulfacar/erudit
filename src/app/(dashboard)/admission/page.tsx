'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconArrowRight, IconBrain, IconChevronDown, IconPhone, IconPlus, IconTrash, IconUser, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { RoleGate } from '@/shared/components/auth/RoleGate';

/**
 * CRM приёмной — воронка от звонка до зачисления (замена Google Sheets).
 * Этапы: заявка → тест → психолог → директор → договор → зачислен / отказ.
 * На зачислении лид становится реальным учеником ядра + счета по графику оплат.
 */

type Stage = 'lead' | 'testing' | 'psych' | 'director' | 'contract' | 'enrolled' | 'rejected';

interface Lead {
  id: string;
  stage: Stage;
  childName: string;
  targetGrade: number;
  parentName: string;
  phone: string;
  source?: string | null;
  mathScore?: number | null;
  englishScore?: number | null;
  psychNote?: string | null;
  decisionNote?: string | null;
  contractAmount?: number | null;
  paymentSchedule?: string | null;
  rejectReason?: string | null;
  enrolledStudentId?: string | null;
  psychCaseId?: string | null;
  updatedAt: string;
}

const RISK_META: Record<string, { label: string; color: string }> = {
  green: { label: 'Зелёный', color: 'green' },
  yellow: { label: 'Жёлтый', color: 'yellow' },
  red: { label: 'Красный', color: 'red' },
};

interface PsychConclusion {
  riskLevel: string;
  status: string;
  summary: string;
  assessment: string;
  observation: string;
  hasConclusion: boolean;
}

interface ClassOption {
  id: string;
  grade: number;
  letter: string;
}

const STAGE_META: Record<Stage, { label: string; color: string }> = {
  lead: { label: 'Заявка', color: 'gray' },
  testing: { label: 'Тестирование', color: 'blue' },
  psych: { label: 'Психолог', color: 'violet' },
  director: { label: 'Директор', color: 'indigo' },
  contract: { label: 'Договор', color: 'orange' },
  enrolled: { label: 'Зачислен', color: 'teal' },
  rejected: { label: 'Отказ', color: 'red' },
};

const PIPELINE: Stage[] = ['lead', 'testing', 'psych', 'director', 'contract', 'enrolled'];
const NEXT_STAGE: Partial<Record<Stage, Stage>> = {
  lead: 'testing',
  testing: 'psych',
  psych: 'director',
  director: 'contract',
  contract: 'enrolled',
};

const SOURCES = ['Звонок', 'Instagram', 'Сайт', 'Рекомендация', 'WhatsApp'];

export default function AdmissionPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [moveLead, setMoveLead] = useState<Lead | null>(null);
  const [moveTo, setMoveTo] = useState<Stage | null>(null);
  // фильтр колонки «Зачислен» по дате (чтобы карточки не копились)
  const [enrFrom, setEnrFrom] = useState('');
  const [enrTo, setEnrTo] = useState('');
  const [rejectLead, setRejectLead] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);

  // G2: заключение психолога по intake-кейсу (видит приёмная)
  const [conclLead, setConclLead] = useState<Lead | null>(null);
  const [concl, setConcl] = useState<PsychConclusion | null>(null);
  const [conclLoading, setConclLoading] = useState(false);

  const openConclusion = async (lead: Lead) => {
    setConclLead(lead); setConcl(null); setConclLoading(true);
    const j = await fetch(`/api/v1/admission/${lead.id}/psych-conclusion`).then((r) => r.json()).catch(() => ({}));
    setConclLoading(false);
    if (j.success) setConcl(j.data);
  };

  // форма создания
  const [form, setForm] = useState({ childName: '', targetGrade: 1, parentName: '', phone: '', source: 'Звонок' });
  // поля этапов
  const [stageFields, setStageFields] = useState<Record<string, unknown>>({});

  const load = useCallback(() => {
    fetch('/api/v1/admission')
      .then((r) => r.json())
      .then((j) => j.success && setLeads(j.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    fetch('/api/v1/classes')
      .then((r) => r.json())
      .then((j) => j.success && setClasses(j.data))
      .catch(() => {});
  }, [load]);

  const byStage = useMemo(() => {
    const map = new Map<Stage, Lead[]>();
    for (const s of Object.keys(STAGE_META) as Stage[]) map.set(s, []);
    for (const l of leads) map.get(l.stage)?.push(l);
    return map;
  }, [leads]);

  const conversion = useMemo(() => {
    const total = leads.length;
    const enrolled = byStage.get('enrolled')?.length ?? 0;
    return total ? Math.round((enrolled / total) * 100) : 0;
  }, [leads, byStage]);

  const createLead = async () => {
    if (!form.childName.trim() || !form.parentName.trim() || !form.phone.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/v1/admission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if ((await res.json()).success) {
        setCreateOpen(false);
        setForm({ childName: '', targetGrade: 1, parentName: '', phone: '', source: 'Звонок' });
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const patchLead = async (id: string, payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admission/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setMoveLead(null);
        setMoveTo(null);
        setRejectLead(null);
        setStageFields({});
        load();
      }
      return json;
    } finally {
      setBusy(false);
    }
  };

  const deleteLead = async (id: string) => {
    await fetch(`/api/v1/admission/${id}`, { method: 'DELETE' });
    load();
  };

  const targetStage = moveLead ? (moveTo ?? NEXT_STAGE[moveLead.stage]) : undefined;

  const inRange = (iso: string) => { const d = iso.slice(0, 10); return (!enrFrom || d >= enrFrom) && (!enrTo || d <= enrTo); };
  const stageCards = (stage: Stage) => { const list = byStage.get(stage) ?? []; return stage === 'enrolled' ? list.filter((l) => inRange(l.updatedAt)) : list; };

  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <Box>
            <Title order={2}>Приёмная — воронка</Title>
            <Text c="dimmed" size="sm">
              От звонка родителя до зачисления: ни один факт не теряется
            </Text>
          </Box>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
            Новая заявка
          </Button>
        </Group>

        {/* Воронка-шапка */}
        <Group gap="xs" wrap="wrap">
          {(Object.keys(STAGE_META) as Stage[]).map((s) => (
            <Paper key={s} px="md" py={6} radius="md" withBorder>
              <Group gap={8}>
                <Badge color={STAGE_META[s].color} variant="dot" size="sm">
                  {STAGE_META[s].label}
                </Badge>
                <Text fw={700}>{byStage.get(s)?.length ?? 0}</Text>
              </Group>
            </Paper>
          ))}
          <Paper px="md" py={6} radius="md" withBorder style={{ backgroundColor: '#f0fdf4' }}>
            <Text size="sm">
              Конверсия в зачисление: <b>{conversion}%</b>
            </Text>
          </Paper>
        </Group>

        {/* Фильтр зачислений по дате */}
        <Group gap="xs" align="flex-end">
          <Text size="xs" c="dimmed" mb={6}>Зачисления:</Text>
          <TextInput size="xs" type="date" label="с" value={enrFrom} onChange={(e) => setEnrFrom(e.currentTarget.value)} />
          <TextInput size="xs" type="date" label="по" value={enrTo} onChange={(e) => setEnrTo(e.currentTarget.value)} />
          {(enrFrom || enrTo) && <Button size="compact-xs" variant="subtle" color="gray" onClick={() => { setEnrFrom(''); setEnrTo(''); }}>Сброс</Button>}
        </Group>

        {/* Канбан */}
        <ScrollArea>
          <Group align="flex-start" gap="sm" wrap="nowrap" style={{ minWidth: 1100 }}>
            {[...PIPELINE, 'rejected' as Stage].map((stage) => (
              <Paper key={stage} w={230} p="xs" radius="md" withBorder style={{ backgroundColor: '#f8f9fb', flexShrink: 0 }}>
                <Group justify="space-between" mb={8} px={4}>
                  <Text size="sm" fw={600}>
                    {STAGE_META[stage].label}
                  </Text>
                  <Badge size="sm" color={STAGE_META[stage].color} variant="light">
                    {stageCards(stage).length}
                  </Badge>
                </Group>
                <Stack gap="xs">
                  {stageCards(stage).map((lead) => (
                    <Card key={lead.id} padding="sm" radius="md" withBorder>
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Box>
                          <Text size="sm" fw={600} lh={1.2}>
                            {lead.childName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            в {lead.targetGrade}-й класс · {lead.source ?? '—'}
                          </Text>
                        </Box>
                        <Tooltip label="Удалить">
                          <Box
                            component="button"
                            onClick={() => deleteLead(lead.id)}
                            style={{ border: 0, background: 'none', cursor: 'pointer', color: '#adb5bd', padding: 2 }}
                          >
                            <IconTrash size={14} />
                          </Box>
                        </Tooltip>
                      </Group>
                      <Group gap={6} mt={6}>
                        <IconPhone size={12} color="#868e96" />
                        <Text size="xs" c="dimmed">
                          {lead.parentName} · {lead.phone}
                        </Text>
                      </Group>
                      {lead.mathScore != null && (
                        <Text size="xs" mt={4}>
                          Тест: мат {lead.mathScore}, англ {lead.englishScore ?? '—'}
                        </Text>
                      )}
                      {lead.psychNote && (
                        <Text size="xs" c="dimmed" mt={4} lineClamp={2}>
                          🧠 {lead.psychNote}
                        </Text>
                      )}
                      {lead.contractAmount != null && (
                        <Text size="xs" mt={4}>
                          💰 {lead.contractAmount.toLocaleString('ru-RU')} сом ·{' '}
                          {lead.paymentSchedule === 'monthly' ? 'помесячно' : lead.paymentSchedule === 'quarterly' ? 'по триместрам' : 'за год'}
                        </Text>
                      )}
                      {lead.rejectReason && (
                        <Text size="xs" c="red" mt={4} lineClamp={2}>
                          {lead.rejectReason}
                        </Text>
                      )}
                      {stage !== 'enrolled' && stage !== 'rejected' && (
                        <Group gap={6} mt={8}>
                          <Button
                            size="compact-xs"
                            variant="light"
                            rightSection={<IconArrowRight size={12} />}
                            onClick={() => {
                              setStageFields({});
                              setMoveTo(NEXT_STAGE[stage]!);
                              setMoveLead(lead);
                            }}
                          >
                            {STAGE_META[NEXT_STAGE[stage]!].label}
                          </Button>
                          {PIPELINE.indexOf(stage) < PIPELINE.length - 2 && (
                            <Menu position="bottom-start" withinPortal>
                              <Menu.Target>
                                <Tooltip label="Пропустить этапы">
                                  <ActionIcon size="sm" variant="light" color="gray"><IconChevronDown size={13} /></ActionIcon>
                                </Tooltip>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Label>Перейти сразу к этапу</Menu.Label>
                                {PIPELINE.slice(PIPELINE.indexOf(stage) + 2).map((tg) => (
                                  <Menu.Item key={tg} onClick={() => { setStageFields({}); setMoveTo(tg); setMoveLead(lead); }}>
                                    {STAGE_META[tg].label}
                                  </Menu.Item>
                                ))}
                              </Menu.Dropdown>
                            </Menu>
                          )}
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="red"
                            leftSection={<IconX size={12} />}
                            onClick={() => {
                              setStageFields({});
                              setRejectLead(lead);
                            }}
                          >
                            Отказ
                          </Button>
                        </Group>
                      )}
                      {stage === 'enrolled' && (
                        <Group gap={6} mt={8}>
                          <Badge size="xs" color="teal" variant="light">в ядре: ученик создан</Badge>
                          {lead.enrolledStudentId && (
                            <Button component={Link} href={`/students/${lead.enrolledStudentId}`} size="compact-xs" variant="light" leftSection={<IconUser size={12} />}>
                              Профиль
                            </Button>
                          )}
                        </Group>
                      )}
                      {lead.psychCaseId && (
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color="grape"
                          mt={6}
                          leftSection={<IconBrain size={12} />}
                          onClick={() => openConclusion(lead)}
                        >
                          Заключение психолога
                        </Button>
                      )}
                    </Card>
                  ))}
                </Stack>
              </Paper>
            ))}
          </Group>
        </ScrollArea>
      </Stack>

      {/* Создание заявки */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Новая заявка" centered>
        <Stack gap="sm">
          <TextInput
            label="Имя ребёнка"
            required
            value={form.childName}
            onChange={(e) => setForm({ ...form, childName: e.currentTarget.value })}
          />
          <NumberInput
            label="В какой класс"
            min={1}
            max={11}
            value={form.targetGrade}
            onChange={(v) => setForm({ ...form, targetGrade: Number(v) || 1 })}
          />
          <TextInput
            label="Родитель"
            required
            value={form.parentName}
            onChange={(e) => setForm({ ...form, parentName: e.currentTarget.value })}
          />
          <TextInput
            label="Телефон"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })}
          />
          <Select
            label="Источник"
            data={SOURCES}
            value={form.source}
            onChange={(v) => setForm({ ...form, source: v ?? 'Звонок' })}
          />
          <Button onClick={createLead} loading={busy}>
            Создать
          </Button>
        </Stack>
      </Modal>

      {/* Перевод на следующий этап */}
      <Modal
        opened={!!moveLead}
        onClose={() => { setMoveLead(null); setMoveTo(null); }}
        title={moveLead && targetStage ? `${moveLead.childName} → ${STAGE_META[targetStage].label}` : ''}
        centered
      >
        {moveLead && targetStage && (
          <Stack gap="sm">
            {targetStage === 'psych' && (
              <>
                <NumberInput
                  label="Балл по математике"
                  min={0}
                  max={100}
                  value={(stageFields.mathScore as number) ?? ''}
                  onChange={(v) => setStageFields({ ...stageFields, mathScore: Number(v) || 0 })}
                />
                <NumberInput
                  label="Балл по английскому"
                  min={0}
                  max={100}
                  value={(stageFields.englishScore as number) ?? ''}
                  onChange={(v) => setStageFields({ ...stageFields, englishScore: Number(v) || 0 })}
                />
              </>
            )}
            {targetStage === 'director' && (
              <Textarea
                label="Заключение психолога"
                autosize
                minRows={3}
                value={(stageFields.psychNote as string) ?? ''}
                onChange={(e) => setStageFields({ ...stageFields, psychNote: e.currentTarget.value })}
              />
            )}
            {targetStage === 'contract' && (
              <Textarea
                label="Решение директора"
                autosize
                minRows={2}
                placeholder="Принять, обратить внимание на..."
                value={(stageFields.decisionNote as string) ?? ''}
                onChange={(e) => setStageFields({ ...stageFields, decisionNote: e.currentTarget.value })}
              />
            )}
            {targetStage === 'enrolled' && (
              <>
                <NumberInput
                  label="Сумма по договору (сом за период)"
                  min={0}
                  value={(stageFields.contractAmount as number) ?? moveLead.contractAmount ?? ''}
                  onChange={(v) => setStageFields({ ...stageFields, contractAmount: Number(v) || 0 })}
                />
                <Select
                  label="График оплат"
                  data={[
                    { value: 'monthly', label: 'Помесячно' },
                    { value: 'quarterly', label: 'По триместрам' },
                    { value: 'yearly', label: 'Раз в год' },
                  ]}
                  value={(stageFields.paymentSchedule as string) ?? moveLead.paymentSchedule ?? 'monthly'}
                  onChange={(v) => setStageFields({ ...stageFields, paymentSchedule: v ?? 'monthly' })}
                />
                <Select
                  label="Класс зачисления"
                  required
                  searchable
                  data={classes.map((c) => ({ value: c.id, label: `${c.grade}${c.letter}` }))}
                  value={(stageFields.classId as string) ?? null}
                  onChange={(v) => setStageFields({ ...stageFields, classId: v })}
                />
                <Text size="xs" c="dimmed">
                  При зачислении в ядре будет создан ученик и счета по графику оплат.
                </Text>
              </>
            )}
            {(targetStage === 'testing') && (
              <Text size="sm" c="dimmed">
                Ребёнок приглашён на тестирование (математика / английский). Баллы внесёте при переводе к психологу.
              </Text>
            )}
            <Button
              loading={busy}
              disabled={targetStage === 'enrolled' && !stageFields.classId}
              onClick={() => patchLead(moveLead.id, { stage: targetStage, ...stageFields })}
            >
              Перевести: {STAGE_META[targetStage].label}
            </Button>
          </Stack>
        )}
      </Modal>

      {/* Отказ */}
      <Modal opened={!!rejectLead} onClose={() => setRejectLead(null)} title={rejectLead ? `Отказ — ${rejectLead.childName}` : ''} centered>
        {rejectLead && (
          <Stack gap="sm">
            <Textarea
              label="Причина (для retention-аналитики)"
              autosize
              minRows={2}
              placeholder="Переезд, цена, выбрали другую школу..."
              value={(stageFields.rejectReason as string) ?? ''}
              onChange={(e) => setStageFields({ ...stageFields, rejectReason: e.currentTarget.value })}
            />
            <Button color="red" loading={busy} onClick={() => patchLead(rejectLead.id, { stage: 'rejected', ...stageFields })}>
              Зафиксировать отказ
            </Button>
          </Stack>
        )}
      </Modal>

      {/* Заключение психолога (intake) — для приёмной */}
      <Modal
        opened={!!conclLead}
        onClose={() => setConclLead(null)}
        title={conclLead ? `Заключение психолога — ${conclLead.childName}` : ''}
        centered
      >
        {conclLoading ? (
          <Group justify="center" p="md"><Loader /></Group>
        ) : !concl ? (
          <Text c="dimmed" size="sm">Заключение не найдено.</Text>
        ) : !concl.hasConclusion ? (
          <Stack gap="xs">
            <Badge color={RISK_META[concl.riskLevel]?.color ?? 'gray'} variant="light">
              Уровень: {RISK_META[concl.riskLevel]?.label ?? concl.riskLevel}
            </Badge>
            <Text c="dimmed" size="sm">Психолог ещё не завершил первичную диагностику — заключение появится позже.</Text>
          </Stack>
        ) : (
          <Stack gap="sm">
            <Badge color={RISK_META[concl.riskLevel]?.color ?? 'gray'} variant="light" size="lg">
              Уровень: {RISK_META[concl.riskLevel]?.label ?? concl.riskLevel}
            </Badge>
            {concl.summary && (
              <div>
                <Text size="xs" fw={600} c="dimmed">Итог / вердикт</Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{concl.summary}</Text>
              </div>
            )}
            {concl.assessment && (
              <div>
                <Text size="xs" fw={600} c="dimmed">Оценка психолога</Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{concl.assessment}</Text>
              </div>
            )}
            {concl.observation && (
              <div>
                <Text size="xs" fw={600} c="dimmed">Наблюдения</Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{concl.observation}</Text>
              </div>
            )}
          </Stack>
        )}
      </Modal>
    </RoleGate>
  );
}
