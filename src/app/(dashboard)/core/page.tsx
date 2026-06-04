'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconArrowRight, IconMaximize } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { TYPE_COLORS, TYPE_LABELS, type GraphNode, type GraphLinkRaw, type ScenarioStep } from './CoreGraph';

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
  scenario?: ScenarioStep[];
  stats?: Record<string, number>;
}

/** Карточка 360° из тулов ассистента (русские ключи — как отдаёт ядро) */
interface StudentCard {
  profile: Record<string, unknown>;
  finance: Record<string, unknown> | null;
  psych: Record<string, unknown> | null;
}

const ATT_LABEL: Record<string, string> = {
  present: 'был(а)',
  absent: 'пропуски',
  late: 'опоздания',
  excused: 'освобожд.',
  trip: 'выезд',
  quarantine: 'карантин',
};

function Student360({ studentId }: { studentId: string }) {
  const [card, setCard] = useState<StudentCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCard(null);
    setError(null);
    fetch(`/api/v1/core/student/${studentId}`)
      .then((r) => r.json())
      .then((j) => (j.success ? setCard(j.data) : setError(j.error?.message ?? 'Ошибка')))
      .catch(() => setError('Нет соединения'));
  }, [studentId]);

  if (error) return <Text c="red">{error}</Text>;
  if (!card) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">Собираю карточку из ядра…</Text>
      </Group>
    );
  }

  const p = card.profile;
  const grades = (p['оценки_по_предметам'] as Array<Record<string, unknown>>) ?? [];
  const attendance = (p['посещаемость_30_дней'] as Record<string, number>) ?? {};
  const achievements = (p['достижения'] as string[]) ?? [];
  const psychRecs = card.psych && !('info' in card.psych) ? ((card.psych['рекомендации'] as Array<Record<string, unknown>>) ?? []) : [];
  const debt = card.finance ? Number(card.finance['задолженность'] ?? 0) : null;

  return (
    <Stack gap="sm">
      <Box>
        <Title order={3}>{String(p['имя'] ?? '')}</Title>
        <Text c="dimmed" size="sm">
          {String(p['класс'] ?? '')}{p['куратор'] ? ` · куратор: ${p['куратор']}` : ''}
        </Text>
      </Box>

      {grades.length > 0 && (
        <Box>
          <Text fw={600} size="sm" mb={4}>Оценки по предметам</Text>
          <Stack gap={4}>
            {grades.slice(0, 6).map((g) => (
              <Group key={String(g['предмет'])} justify="space-between" gap={8} wrap="nowrap">
                <Text size="sm" lineClamp={1}>{String(g['предмет'])}</Text>
                <Group gap={4} wrap="nowrap">
                  <Badge size="sm" variant="light" color={Number(g['средний']) >= 4 ? 'teal' : Number(g['средний']) >= 3 ? 'yellow' : 'red'} radius="sm">
                    {String(g['средний'])}
                  </Badge>
                  <Text size="xs" c="dimmed">{(g['последние'] as number[]).join(' ')}</Text>
                </Group>
              </Group>
            ))}
          </Stack>
        </Box>
      )}

      {Object.keys(attendance).length > 0 && (
        <Box>
          <Text fw={600} size="sm" mb={4}>Посещаемость, 30 дней</Text>
          <Group gap={6}>
            {Object.entries(attendance).map(([k, v]) => (
              <Badge key={k} size="sm" variant="light" color={k === 'present' ? 'teal' : k === 'absent' ? 'red' : 'yellow'} radius="sm">
                {ATT_LABEL[k] ?? k}: {v}
              </Badge>
            ))}
          </Group>
        </Box>
      )}

      {psychRecs.length > 0 && (
        <Box>
          <Divider mb={6} />
          <Text fw={600} size="sm" mb={4}>🧠 Психолог</Text>
          {psychRecs.slice(0, 2).map((r, i) => (
            <Text key={i} size="xs" c="dimmed" mb={4}>
              {String(r['текст'])}
            </Text>
          ))}
        </Box>
      )}

      {debt !== null && (
        <Box>
          <Divider mb={6} />
          <Text fw={600} size="sm" mb={4}>💰 Оплата</Text>
          {debt > 0 ? (
            <Badge color="red" variant="light" radius="sm">задолженность: {debt.toLocaleString('ru-RU')} сом</Badge>
          ) : (
            <Badge color="teal" variant="light" radius="sm">задолженности нет</Badge>
          )}
        </Box>
      )}

      {achievements.length > 0 && (
        <Text size="xs" c="dimmed">🏆 {achievements.slice(0, 2).join('; ')}</Text>
      )}

      <Button
        component="a"
        href={`/students/${studentId}`}
        variant="light"
        size="xs"
        rightSection={<IconArrowRight size={14} />}
      >
        Полный профиль
      </Button>
    </Stack>
  );
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

  // подгон под контейнер (+фуллскрин: граф занимает весь экран)
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const fs = document.fullscreenElement === containerRef.current;
        setSize({
          width: fs ? window.innerWidth : containerRef.current.clientWidth,
          height: fs ? window.innerHeight : Math.max(window.innerHeight - 260, 420),
        });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    document.addEventListener('fullscreenchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      document.removeEventListener('fullscreenchange', measure);
    };
  }, [data]);

  const enterFullscreen = useCallback(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

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
          <Group gap="xs">
            {data?.stats &&
              Object.entries(data.stats).map(([k, v]) => (
                <Badge key={k} variant="light" size="lg" radius="sm">
                  {k}: {v}
                </Badge>
              ))}
            <Tooltip label="На весь экран (для проектора)">
              <ActionIcon variant="light" size="lg" radius="md" onClick={enterFullscreen} aria-label="На весь экран">
                <IconMaximize size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
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
              scenario={data.scenario ?? []}
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
        {selected && selected.type === 'student' ? (
          <Student360 studentId={selected.id.replace(/^s-/, '')} />
        ) : selected ? (
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
        ) : null}
      </Drawer>
    </RoleGate>
  );
}
