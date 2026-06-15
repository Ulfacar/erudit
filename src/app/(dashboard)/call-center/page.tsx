'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Anchor, Badge, Button, Group, Loader, Modal, Paper, Select, SimpleGrid, Stack, Text, Textarea, Title } from '@mantine/core';
import { IconHeadset, IconCoin, IconUsers, IconAlertTriangle, IconPhone } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { fmtDate } from '@/shared/components/ui/resource-helpers';
import { DrilldownByClass, type DrillGroup } from '@/shared/components/DrilldownByClass';

interface Debtor {
  studentId: string; name: string; className: string; phone: string | null;
  remaining: number; penalty: number; overdueDays: number;
  lastTask: { status: string | null; text: string; at: string } | null;
}

const som = (n: number) => `${n.toLocaleString('ru-RU')} сом`;

// Исходы звонка (как в референсе) + дефолт
const TASK_STATUS: Record<string, { label: string; color: string }> = {
  no_contact: { label: 'Нет контакта', color: 'gray' },
  contacted: { label: 'Связались', color: 'blue' },
  promise_to_pay: { label: 'Обещал оплатить', color: 'teal' },
  refused: { label: 'Отказ', color: 'red' },
  closed: { label: 'Закрыто', color: 'green' },
};
const STATUS_OPTIONS = Object.entries(TASK_STATUS).map(([value, v]) => ({ value, label: v.label }));

function priorityOf(d: Debtor): { label: string; color: string } {
  if (d.overdueDays > 30 || d.remaining > 50000) return { label: 'Высокий', color: 'red' };
  if (d.overdueDays > 10) return { label: 'Средний', color: 'orange' };
  return { label: 'Низкий', color: 'green' };
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group gap="xs" mb={4}>{icon}<Text size="xs" c="dimmed" tt="uppercase">{label}</Text></Group>
      <Text fw={700} size="xl" c={color}>{value}</Text>
    </Paper>
  );
}

function CallCenter() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Debtor | null>(null);
  const [status, setStatus] = useState<string>('contacted');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch('/api/v1/finance/debtors').then((r) => r.json()).catch(() => ({ data: [] }));
    setDebtors(j.data ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function openCall(d: Debtor) {
    setTarget(d);
    setStatus(d.lastTask?.status && TASK_STATUS[d.lastTask.status] ? d.lastTask.status : 'contacted');
    setNote('');
  }

  async function saveCall() {
    if (!target) return;
    setSaving(true);
    await fetch(`/api/v1/students/${target.studentId}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'collection', text: note || TASK_STATUS[status]?.label || 'Звонок', meta: { status } }),
    });
    setSaving(false); setTarget(null); setNote(''); load();
  }

  const totalDebt = useMemo(() => debtors.reduce((s, d) => s + d.remaining, 0), [debtors]);
  const totalPenalty = useMemo(() => debtors.reduce((s, d) => s + d.penalty, 0), [debtors]);

  // Группировка должников по классам (как просил Эмир — у референса плоский список)
  const groups = useMemo<DrillGroup[]>(() => {
    const m = new Map<string, Debtor[]>();
    for (const d of debtors) {
      const k = d.className || '—';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(d);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
      .map(([cls, list]) => ({
        key: cls, title: cls, count: list.length, countColor: 'red',
        subtitle: `Долг: ${som(list.reduce((s, d) => s + d.remaining, 0))}`,
        items: [...list].sort((a, b) => b.remaining - a.remaining).map((d) => {
          const pr = priorityOf(d);
          const st = d.lastTask?.status ? TASK_STATUS[d.lastTask.status] : null;
          return {
            id: d.studentId,
            href: `/students/${d.studentId}`,
            primary: d.name,
            secondary: [d.phone ?? 'без телефона', d.lastTask ? `${st?.label ?? 'контакт'}: ${d.lastTask.text} (${fmtDate(d.lastTask.at)})` : null].filter(Boolean).join(' · '),
            right: (
              <Group gap={6} wrap="nowrap">
                <Badge color={pr.color} variant="dot" size="sm">{pr.label}</Badge>
                <Text fw={600} c="blue">{som(d.remaining)}</Text>
                <Badge color={d.overdueDays > 30 ? 'red' : 'orange'} variant="light">{d.overdueDays} дн</Badge>
                {st && <Badge color={st.color} variant="light" size="sm">{st.label}</Badge>}
              </Group>
            ),
            action: <Button size="compact-xs" variant="light" leftSection={<IconPhone size={12} />} onClick={() => openCall(d)}>Звонок</Button>,
          };
        }),
      }));
  }, [debtors]);

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconHeadset size={26} color="#1971c2" /><Title order={2}>Колл-центр — взыскание</Title></Group>
      <Text c="dimmed" size="sm">Должники по классам. Кликните класс → ученика, чтобы открыть договор, график оплаты и телефоны. Фиксируйте исход звонка.</Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <StatCard icon={<IconUsers size={15} color="#e8590c" />} label="Должников" value={String(debtors.length)} color="#e8590c" />
        <StatCard icon={<IconCoin size={15} color="#1971c2" />} label="Сумма долга" value={som(totalDebt)} color="#1971c2" />
        <StatCard icon={<IconAlertTriangle size={15} color="#e03131" />} label="Пеня" value={som(totalPenalty)} color="#e03131" />
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        {loading ? <Group justify="center" p="xl"><Loader /></Group>
          : <DrilldownByClass groups={groups} emptyText="Должников нет 🎉" />}
      </Paper>

      <Modal opened={!!target} onClose={() => setTarget(null)} title={`Результат звонка — ${target?.name}`} centered>
        <Stack gap="md">
          {target?.phone && <Text size="sm">Телефон: <Anchor href={`tel:${target.phone}`}>{target.phone}</Anchor></Text>}
          <Select label="Исход звонка" data={STATUS_OPTIONS} value={status} onChange={(v) => setStatus(v ?? 'contacted')} />
          <Textarea label="Комментарий" placeholder="Что обещал родитель / о чём договорились…" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setTarget(null)}>Отмена</Button>
            <Button onClick={saveCall} loading={saving}>Сохранить</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function CallCenterPage() {
  return (
    <RoleGate roles={['call_center', 'super_admin', 'analyst', 'zavuch', 'accountant']}>
      <CallCenter />
    </RoleGate>
  );
}
