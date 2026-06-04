'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Badge,
  Box,
  Drawer,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { TYPE_COLORS, TYPE_LABELS, type GraphNode, type GraphLinkRaw } from './CoreGraph';

// canvas-граф — только на клиенте (ssr:false)
const CoreGraph = dynamic(() => import('./CoreGraph'), {
  ssr: false,
  loading: () => (
    <Group justify="center" py={120}>
      <Loader />
      <Text c="dimmed">Собираю ядро школы…</Text>
    </Group>
  ),
});

/**
 * Граф ядра: школа как единый живой организм. Центральное ядро,
 * домены-модули, классы, педагоги и ученики — реальные данные из базы,
 * связанные как нейронные связи.
 */

interface GraphData {
  nodes: GraphNode[];
  links: GraphLinkRaw[];
  stats?: Record<string, number>;
}

export default function CoreGraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 560 });

  useEffect(() => {
    fetch('/api/v1/core/graph')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data);
        else setError(j.error?.message ?? 'Ошибка загрузки');
      })
      .catch(() => setError('Нет соединения с сервером'));
  }, []);

  // подгон под контейнер
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.clientWidth,
          height: Math.max(window.innerHeight - 260, 420),
        });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [data]);

  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <Box>
            <Title order={2}>Граф ядра</Title>
            <Text c="dimmed" size="sm">
              Школа как единый организм: все модули и люди связаны в одном ядре данных
            </Text>
          </Box>
          {data?.stats && (
            <Group gap="xs">
              {Object.entries(data.stats).map(([k, v]) => (
                <Badge key={k} variant="light" size="lg" radius="sm">
                  {k}: {v}
                </Badge>
              ))}
            </Group>
          )}
        </Group>

        <Group gap="md">
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <Group key={type} gap={6}>
              <Box w={10} h={10} style={{ borderRadius: '50%', backgroundColor: TYPE_COLORS[type as GraphNode['type']] }} />
              <Text size="xs" c="dimmed">
                {label}
              </Text>
            </Group>
          ))}
        </Group>

        <Paper ref={containerRef} withBorder radius="lg" style={{ overflow: 'hidden', backgroundColor: '#0b1220' }}>
          {error ? (
            <Text c="red" p="xl">
              {error}
            </Text>
          ) : !data ? (
            <Group justify="center" py={120}>
              <Loader />
              <Text c="dimmed">Собираю ядро школы…</Text>
            </Group>
          ) : (
            <CoreGraph
              width={size.width}
              height={size.height}
              nodes={data.nodes}
              links={data.links}
              onNodeClick={setSelected}
            />
          )}
        </Paper>
      </Stack>

      <Drawer
        opened={!!selected}
        onClose={() => setSelected(null)}
        position="right"
        title={selected ? TYPE_LABELS[selected.type] : ''}
        size="sm"
      >
        {selected && (
          <Stack gap="sm">
            <Title order={3}>{selected.label}</Title>
            {selected.meta && <Text c="dimmed">{selected.meta}</Text>}
            {typeof selected.count === 'number' && (
              <Badge size="lg" variant="light" color="blue" radius="sm">
                записей: {selected.count}
              </Badge>
            )}
            <Text size="sm" c="dimmed">
              Каждый модуль обновляет свою зону данных, а ядро связывает всё в единый профиль —
              как нейронные связи единого организма.
            </Text>
          </Stack>
        )}
      </Drawer>
    </RoleGate>
  );
}
