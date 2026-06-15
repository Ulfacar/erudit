'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Anchor, Badge, Button, Group, Loader, Modal, Paper, SimpleGrid, Stack, Text, Textarea, Title } from '@mantine/core';
import { IconHeadset, IconCoin, IconUsers, IconAlertTriangle } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { fmtDate } from '@/shared/components/ui/resource-helpers';
import { DrilldownByClass, type DrillGroup } from '@/shared/components/DrilldownByClass';

interface Debtor {
  studentId: string; name: string; className: string; phone: string | null;
  remaining: number; penalty: number; overdueDays: number;
  lastPromise: { text: string; at: string } | null;
}

const som = (n: number) => `${n.toLocaleString('ru-RU')} сом`;

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
  const [promiseText, setPromiseText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch('/api/v1/finance/debtors').then((r) => r.json()).catch(() => ({ data: [] }));
    setDebtors(j.data ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function savePromise() {
    if (!target || !promiseText.trim()) return;
    setSaving(true);
    await fetch(`/api/v1/students/${target.studentId}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'promise', text: promiseText }),
    });
    setSaving(false); setTarget(null); setPromiseText(''); load();
  }

  const totalDebt = useMemo(() => debtors.reduce((s, d) => s + d.remaining, 0), [debtors]);
  const totalPenalty = useMemo(() => debtors.reduce((s, d) => s + d.penalty, 0), [debtors]);

  // Группировка должников по классам
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
        items: [...list].sort((a, b) => b.remaining - a.remaining).map((d) => ({
          id: d.studentId,
          href: `/students/${d.studentId}`,
          primary: d.name,
          secondary: [d.phone ?? 'без телефона', d.lastPromise ? `обещал: ${d.lastPromise.text} (${fmtDate(d.lastPromise.at)})` : null].filter(Boolean).join(' · '),
          right: (
            <Group gap={6} wrap="nowrap">
              <Text fw={600} c="blue">{som(d.remaining)}</Text>
              <Badge color={d.overdueDays > 30 ? 'red' : 'orange'} variant="light">{d.overdueDays} дн</Badge>
            </Group>
          ),
          action: <Button size="compact-xs" variant="light" onClick={() => setTarget(d)}>Обещание</Button>,
        })),
      }));
  }, [debtors]);

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconHeadset size={26} color="#1971c2" /><Title order={2}>Колл-центр — взыскание</Title></Group>
      <Text c="dimmed" size="sm">Должники по классам. Кликните класс → ученика, чтобы открыть договор, график оплаты и телефоны. Фиксируйте обещания и приём оплаты.</Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <StatCard icon={<IconUsers size={15} color="#e8590c" />} label="Должников" value={String(debtors.length)} color="#e8590c" />
        <StatCard icon={<IconCoin size={15} color="#1971c2" />} label="Сумма долга" value={som(totalDebt)} color="#1971c2" />
        <StatCard icon={<IconAlertTriangle size={15} color="#e03131" />} label="Пеня" value={som(totalPenalty)} color="#e03131" />
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        {loading ? <Group justify="center" p="xl"><Loader /></Group>
          : <DrilldownByClass groups={groups} emptyText="Должников нет 🎉" />}
      </Paper>

      <Modal opened={!!target} onClose={() => setTarget(null)} title={`Обещание оплаты — ${target?.name}`} centered>
        <Stack gap="md">
          {target?.phone && <Text size="sm">Телефон: <Anchor href={`tel:${target.phone}`}>{target.phone}</Anchor></Text>}
          <Textarea label="Что обещал родитель" placeholder="Обещал оплатить завтра / перевёл на мбанк, скинет чек…" autosize minRows={2} value={promiseText} onChange={(e) => setPromiseText(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setTarget(null)}>Отмена</Button>
            <Button onClick={savePromise} loading={saving}>Сохранить</Button>
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
