'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, Group, NumberInput, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconChartLine } from '@tabler/icons-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

interface Point { id: string; metric: string; date: string; value: number; normalized: number; templateVersion: number }

export function Dynamics({ caseId }: { caseId: string }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [metric, setMetric] = useState('тревожность');
  const [value, setValue] = useState<number>(5);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch(`/api/v1/psy/measurements?caseId=${caseId}`).then((r) => r.json()).catch(() => ({ data: [] }));
    setPoints(j.data ?? []);
  }, [caseId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!metric.trim()) return;
    setSaving(true);
    await fetch('/api/v1/psy/measurements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, metric, value }),
    });
    setSaving(false); load();
  }

  // данные графика: нормализованные значения (склейка версий через mappingRule)
  const chartData = points.map((p) => ({ date: fmtDate(p.date), [p.metric]: p.normalized }));
  const metrics = [...new Set(points.map((p) => p.metric))];
  const versions = [...new Set(points.map((p) => p.templateVersion))].sort((a, b) => a - b);
  const colors = ['#9c36b5', '#1971c2', '#2f9e44', '#e8590c'];

  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="xs" mb="sm"><IconChartLine size={20} color="#1971c2" /><Title order={5}>Динамика (до/после)</Title></Group>
      {points.length === 0 ? (
        <Text c="dimmed" size="sm">Точек пока нет — добавьте замер ниже.</Text>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={11} />
            <YAxis fontSize={11} />
            <RTooltip />
            {metrics.map((m, i) => <Line key={m} type="monotone" dataKey={m} stroke={colors[i % colors.length]} strokeWidth={2} />)}
          </LineChart>
        </ResponsiveContainer>
      )}
      {versions.length > 0 && (
        <Text size="xs" c="dimmed" mt={4}>
          Методики: {versions.map((v) => `v${v}`).join(', ')}
          {versions.length > 1 ? ' · значения склеены через правило пересчёта (mapping)' : ''}
        </Text>
      )}
      <Group gap="xs" mt="sm" align="flex-end">
        <TextInput label="Метрика" value={metric} onChange={(e) => setMetric(e.currentTarget.value)} w={180} />
        <NumberInput label="Значение" value={value} onChange={(v) => setValue(Number(v) || 0)} w={120} />
        <Button onClick={add} loading={saving}>Добавить замер</Button>
      </Group>
    </Paper>
  );
}
