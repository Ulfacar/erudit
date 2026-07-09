'use client';

import { Badge, Button, Group, Loader, NumberInput, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSettings } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

const ROLES = ['olympiad_coach', 'super_admin', 'analyst', 'zavuch'] as const;

type KpiConfig = { w1: number; w2: number; w3: number; version: number };

function numberValue(value: string | number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function SettingsContent() {
  const queryClient = useQueryClient();
  const [weights, setWeights] = useState({ w1: 0.5, w2: 0.3, w3: 0.2 });
  const configQuery = useQuery<KpiConfig>({
    queryKey: ['olympiad-kpi-config'],
    queryFn: async () => {
      const res = await fetch('/api/v1/olympiad-center/kpi-config');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось загрузить настройки KPI');
      return json.data;
    },
  });

  useEffect(() => {
    if (configQuery.data) setWeights({ w1: configQuery.data.w1, w2: configQuery.data.w2, w3: configQuery.data.w3 });
  }, [configQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/olympiad-center/kpi-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weights),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Не удалось сохранить настройки KPI');
      return json.data as KpiConfig;
    },
    onSuccess: (data) => {
      notifications.show({ color: 'green', title: 'Готово', message: 'Настройки KPI сохранены' });
      queryClient.setQueryData(['olympiad-kpi-config'], data);
    },
    onError: (error) => notifications.show({ color: 'red', title: 'Ошибка', message: error instanceof Error ? error.message : 'Не удалось сохранить настройки KPI' }),
  });

  if (configQuery.isLoading) return <Group justify="center" py="xl"><Loader /></Group>;
  if (configQuery.isError || !configQuery.data) return <Text c="red">Не удалось загрузить настройки KPI</Text>;

  const sum = weights.w1 + weights.w2 + weights.w3;
  const valid = Math.abs(sum - 1) <= 0.001 && Object.values(weights).every((value) => value >= 0 && value <= 1);

  return (
    <Stack gap="md" maw={720}>
      <Group gap="sm">
        <ThemeIcon size={40} radius="sm" color="blue" variant="light"><IconSettings size={22} /></ThemeIcon>
        <div>
          <Title order={2}>Настройки KPI</Title>
          <Text size="sm" c="dimmed">Текущая версия: {configQuery.data.version}</Text>
        </div>
      </Group>

      <Paper withBorder radius="sm" p="md">
        <Stack gap="md">
          <Group grow align="flex-start">
            <NumberInput label="w1" min={0} max={1} step={0.05} decimalScale={2} value={weights.w1} onChange={(value) => setWeights((current) => ({ ...current, w1: numberValue(value) }))} />
            <NumberInput label="w2" min={0} max={1} step={0.05} decimalScale={2} value={weights.w2} onChange={(value) => setWeights((current) => ({ ...current, w2: numberValue(value) }))} />
            <NumberInput label="w3" min={0} max={1} step={0.05} decimalScale={2} value={weights.w3} onChange={(value) => setWeights((current) => ({ ...current, w3: numberValue(value) }))} />
          </Group>
          <Group justify="space-between">
            <Badge variant="light" color={valid ? 'green' : 'red'} radius="sm">Сумма: {sum.toFixed(3)}</Badge>
            <Button loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>Сохранить</Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}

export default function OlympiadCenterSettingsPage() {
  return (
    <RoleGate roles={[...ROLES]}>
      <SettingsContent />
    </RoleGate>
  );
}
