'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Card, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { IconShieldLock, IconAlertTriangle } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

const ST = { open: { label: 'Открыт', color: 'red' }, in_progress: { label: 'В работе', color: 'orange' }, resolved: { label: 'Закрыт', color: 'green' } } as const;

interface Alert { id: string; status: keyof typeof ST; createdAt: string; reason: string; studentInitials: string; riskLevel: string; escalatedAt: string | null; remindCount: number }

function Safeguarding() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/v1/psy/safeguarding').then((r) => r.json()).catch(() => ({ data: [] }));
    setAlerts(j.data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function patch(alertId: string, status: 'in_progress' | 'resolved') {
    await fetch('/api/v1/psy/safeguarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alertId, status }) });
    load();
  }

  const open = alerts.filter((a) => a.status !== 'resolved');

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconShieldLock size={26} color="#e03131" /><Title order={2}>Координатор безопасности</Title></Group>
      <Text c="dimmed" size="sm">Закрытый контур. Здесь раскрываются инициалы и причина критических кейсов. На телефон приходит только «Требуется авторизация» — без имён.</Text>

      {loading ? <Group justify="center" p="xl"><Loader /></Group>
        : alerts.length === 0 ? <Paper withBorder p="xl" radius="md"><Text c="dimmed" ta="center">Критических уведомлений нет.</Text></Paper>
        : (
          <Stack gap="sm">
            {alerts.map((a) => (
              <Card key={a.id} withBorder radius="md" style={{ borderColor: a.status === 'open' ? '#ffc9c9' : undefined }}>
                <Group justify="space-between" align="flex-start">
                  <Group gap="xs" align="flex-start">
                    <IconAlertTriangle size={20} color="#e03131" />
                    <div>
                      <Text fw={600}>Критический риск · Ученик {a.studentInitials}</Text>
                      <Text size="sm" c="dimmed">Причина: {a.reason}</Text>
                      <Text size="xs" c="dimmed" mt={4}>{fmtDate(a.createdAt)}</Text>
                    </div>
                  </Group>
                  <Group gap="xs">
                    {a.escalatedAt && a.status === 'open' && (
                      <Badge color="red" variant="filled">⬆ Эскалировано директору{a.remindCount > 1 ? ` · напоминаний: ${a.remindCount}` : ''}</Badge>
                    )}
                    <Badge color={ST[a.status].color}>{ST[a.status].label}</Badge>
                    {a.status === 'open' && <Button size="xs" color="orange" onClick={() => patch(a.id, 'in_progress')}>Взять в работу</Button>}
                    {a.status === 'in_progress' && <Button size="xs" variant="light" color="green" onClick={() => patch(a.id, 'resolved')}>Закрыть</Button>}
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
    </Stack>
  );
}

export default function SafeguardingPage() {
  return (
    <RoleGate roles={['safeguarding_lead', 'zavuch', 'super_admin']}>
      <Safeguarding />
    </RoleGate>
  );
}
